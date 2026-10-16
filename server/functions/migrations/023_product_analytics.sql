-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 023: Product Analytics Tables
-- Privacy-first analytics for أجر لا ينقطع
-- ═══════════════════════════════════════════════════════════════════════════

-- Main events table
CREATE TABLE IF NOT EXISTS analytics_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),

    -- Event identification
    event_type text NOT NULL,          -- page_view, click, submit, share, error, etc.
    event_name text,                   -- human-readable name
    event_data jsonb DEFAULT '{}'::jsonb, -- flexible event payload

    -- Page context
    page_path text,                    -- /index.html, /community.html, etc.
    page_title text,                   -- page document.title
    referrer text,                     -- document.referrer (origin only)
    referrer_domain text,              -- extracted domain from referrer

    -- Campaign / UTM tracking
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_content text,
    utm_term text,

    -- Session tracking (anonymous, hashed)
    session_id text NOT NULL,          -- SHA-256 of (IP + user agent + date), truncated
    is_returning boolean DEFAULT false,

    -- Device / Browser (approximate only)
    device_type text,                  -- mobile, tablet, desktop
    browser text,                      -- chrome, safari, firefox, etc.
    os text,                           -- android, ios, windows, macos, linux
    screen_width integer,
    screen_height integer,
    language text,                     -- browser language

    -- Geographic (approximate, from Cloudflare/Netlify headers if available)
    country text,                      -- 2-letter country code
    region text,                       -- region/state

    -- Performance
    load_time_ms integer,              -- page load time
    interaction_time_ms integer        -- time to first interaction
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_path ON analytics_events(page_path);
CREATE INDEX IF NOT EXISTS idx_analytics_events_referrer ON analytics_events(referrer_domain);
CREATE INDEX IF NOT EXISTS idx_analytics_events_country ON analytics_events(country);
CREATE INDEX IF NOT EXISTS idx_analytics_events_device ON analytics_events(device_type);

-- Composite indexes for dashboard queries (not using expression indexes
-- because created_at::date is not IMMUTABLE in PostgreSQL, causing
-- "functions in index expression must be marked IMMUTABLE" error)
-- Queries should use range filtering instead:
--   WHERE created_at >= '2024-01-01' AND created_at < '2024-01-02'

-- Daily aggregates table (for fast dashboard queries)
CREATE TABLE IF NOT EXISTS analytics_daily_stats (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    date date NOT NULL UNIQUE,
    page_views integer DEFAULT 0,
    unique_visitors integer DEFAULT 0,
    returning_visitors integer DEFAULT 0,
    sessions integer DEFAULT 0,
    avg_session_duration_sec integer DEFAULT 0,
    bounce_rate numeric DEFAULT 0,      -- percentage 0-100
    top_pages jsonb DEFAULT '[]'::jsonb,
    top_referrers jsonb DEFAULT '[]'::jsonb,
    top_countries jsonb DEFAULT '[]'::jsonb,
    top_devices jsonb DEFAULT '[]'::jsonb,
    top_browsers jsonb DEFAULT '[]'::jsonb,
    total_events integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_stats_date ON analytics_daily_stats(date DESC);

-- RLS policies — only service role can write/read analytics
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily_stats ENABLE ROW LEVEL SECURITY;

-- No public access to analytics data
-- Only service_role (Netlify functions) can access

-- ═══════════════════════════════════════════════════════════════════════════
-- Function: Compute daily stats from events (called by scheduled function)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_daily_stats(target_date date DEFAULT CURRENT_DATE)
RETURNS void AS $$
DECLARE
    v_page_views integer;
    v_unique_visitors integer;
    v_returning integer;
    v_sessions integer;
    v_total_events integer;
BEGIN
    -- Count metrics for the target date
    SELECT
        COUNT(*) FILTER (WHERE event_type = 'page_view'),
        COUNT(DISTINCT session_id),
        COUNT(*) FILTER (WHERE is_returning = true),
        COUNT(DISTINCT session_id),
        COUNT(*)
    INTO v_page_views, v_unique_visitors, v_returning, v_sessions, v_total_events
    FROM analytics_events
    WHERE created_at >= target_date AND created_at < target_date + 1;

    -- Upsert daily stats
    INSERT INTO analytics_daily_stats (
        date, page_views, unique_visitors, returning_visitors,
        sessions, total_events, updated_at
    ) VALUES (
        target_date, v_page_views, v_unique_visitors, v_returning,
        v_sessions, v_total_events, now()
    )
    ON CONFLICT (date) DO UPDATE SET
        page_views = EXCLUDED.page_views,
        unique_visitors = EXCLUDED.unique_visitors,
        returning_visitors = EXCLUDED.returning_visitors,
        sessions = EXCLUDED.sessions,
        total_events = EXCLUDED.total_events,
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════
-- Cleanup: Delete events older than 90 days (privacy + storage management)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION cleanup_analytics_events()
RETURNS integer AS $$
DECLARE
    v_deleted integer;
BEGIN
    WITH deleted AS (
        DELETE FROM analytics_events
        WHERE created_at < (CURRENT_DATE - INTERVAL '90 days')
        RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted FROM deleted;

    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
