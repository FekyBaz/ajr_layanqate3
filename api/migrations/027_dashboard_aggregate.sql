-- Dashboard aggregates in a single RPC (see issues #81, #112).
-- Replaces the 10 unbounded full-table reads in analytics-dashboard.js,
-- which had to be capped at 5000 rows to avoid OOMing the function.
-- Aggregation happens in Postgres, so full windows stay exact.
-- Safe to run multiple times.

CREATE OR REPLACE FUNCTION public.get_analytics_dashboard(p_start timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
WITH windowed AS (
    SELECT * FROM public.analytics_events WHERE created_at >= p_start
),
page_views AS (
    SELECT * FROM windowed WHERE event_type = 'page_view'
),
all_sessions AS (
    SELECT DISTINCT session_id FROM windowed
),
pv_sessions AS (
    SELECT session_id, bool_or(is_returning) AS returning
    FROM page_views GROUP BY session_id
),
daily AS (
    SELECT (date_trunc('day', created_at))::date AS day,
           COUNT(*) AS views,
           COUNT(DISTINCT session_id) AS visitors
    FROM windowed GROUP BY 1
),
sources AS (
    SELECT COALESCE(NULLIF(utm_source, ''), NULLIF(referrer_domain, ''), 'direct') AS source,
           COUNT(*) AS count
    FROM page_views GROUP BY 1 ORDER BY 2 DESC LIMIT 20
),
pages AS (
    SELECT page_path AS path, MAX(page_title) AS title, COUNT(*) AS views
    FROM page_views GROUP BY 1 ORDER BY 3 DESC LIMIT 20
),
devices AS (
    SELECT device_type AS name, COUNT(*) AS count
    FROM page_views WHERE device_type IS NOT NULL GROUP BY 1 ORDER BY 2 DESC
),
browsers AS (
    SELECT browser AS name, COUNT(*) AS count
    FROM page_views WHERE browser IS NOT NULL GROUP BY 1 ORDER BY 2 DESC
),
oses AS (
    SELECT os AS name, COUNT(*) AS count
    FROM page_views WHERE os IS NOT NULL GROUP BY 1 ORDER BY 2 DESC
),
countries AS (
    SELECT country, COUNT(*) AS count
    FROM page_views WHERE country IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 30
),
features AS (
    SELECT COALESCE(event_name, event_type) AS key, COUNT(*) AS count
    FROM windowed GROUP BY 1
),
landing AS (
    SELECT DISTINCT session_id FROM windowed
    WHERE event_type = 'page_view' AND page_path IN ('/', '/index.html')
),
inter AS (
    SELECT DISTINCT session_id FROM windowed
    WHERE event_type IN ('click', 'scroll', 'cta_click')
),
subm AS (
    SELECT DISTINCT session_id FROM windowed WHERE event_type = 'submit'
)
SELECT jsonb_build_object(
    'overview', (
        SELECT jsonb_build_object(
            'page_views', (SELECT COUNT(*) FROM page_views),
            'unique_visitors', (SELECT COUNT(*) FROM pv_sessions),
            'returning_visitors', (SELECT COUNT(*) FROM pv_sessions WHERE returning),
            'total_events', (SELECT COUNT(*) FROM windowed),
            'avg_events_per_session', (
                SELECT CASE WHEN COUNT(*) = 0 THEN 0
                    ELSE ROUND(COUNT(*)::numeric / COUNT(DISTINCT session_id), 1) END
                FROM windowed
            ),
            'daily_trend', COALESCE((
                SELECT jsonb_agg(jsonb_build_object('date', day, 'views', views, 'visitors', visitors) ORDER BY day)
                FROM daily
            ), '[]'::jsonb)
        )
    ),
    'traffic_sources', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('source', source, 'count', count)) FROM sources
    ), '[]'::jsonb),
    'top_pages', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('path', path, 'title', title, 'views', views)) FROM pages
    ), '[]'::jsonb),
    'devices', jsonb_build_object(
        'devices', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', name, 'count', count)) FROM devices), '[]'::jsonb),
        'browsers', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', name, 'count', count)) FROM browsers), '[]'::jsonb),
        'os', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', name, 'count', count)) FROM oses), '[]'::jsonb)
    ),
    'geography', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('country', country, 'count', count)) FROM countries
    ), '[]'::jsonb),
    'feature_usage', COALESCE((
        SELECT jsonb_object_agg(key, count) FROM features
    ), '{}'::jsonb),
    'funnels', jsonb_build_object(
        'landing_to_interaction', jsonb_build_object(
            'total', (SELECT COUNT(*) FROM landing),
            'converted', (SELECT COUNT(*) FROM landing JOIN inter USING (session_id))
        ),
        'landing_to_submission', jsonb_build_object(
            'total', (SELECT COUNT(*) FROM landing),
            'converted', (SELECT COUNT(*) FROM landing JOIN subm USING (session_id))
        )
    ),
    'retention', (
        SELECT jsonb_build_object(
            'returning_rate', CASE WHEN COUNT(*) = 0 THEN 0
                ELSE ROUND(COUNT(*) FILTER (WHERE returning)::numeric / COUNT(*) * 100) END,
            'repeat_sessions', COUNT(*) FILTER (WHERE returning),
            'total_sessions', COUNT(*)
        )
        FROM pv_sessions
    )
);
$$;

-- Lock down the boundary (same convention as 015_strict_rpc_security.sql).
REVOKE ALL ON FUNCTION public.get_analytics_dashboard(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_analytics_dashboard(timestamptz) TO service_role;
