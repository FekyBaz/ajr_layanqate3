-- ═══════════════════════════════════════════════════════════════════════════
-- أجر لا ينقطع — Migration 012 (Hardened)
-- Defensive Architecture Hardening: 64-bit locks, Composite indexes, Atomic inserts
-- ═══════════════════════════════════════════════════════════════════════════

-- 0. Infrastructure: Hardened indexing for high-frequency lookups
-- Optimized for range scans on created_at per IP (O(log N))
CREATE INDEX IF NOT EXISTS idx_rate_limits_composite ON public.rate_limits (ip_hash, created_at DESC);

-- 1. Atomic submit RPC to prevent race condition bypassing rate limits
CREATE OR REPLACE FUNCTION public.submit_post(
    p_message text,
    p_message_hash text,
    p_content_type text,
    p_author_name text,
    p_ip_hash text,
    p_rate_limit_max integer,
    p_rate_limit_hours integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_window_start timestamptz;
    v_recent_count integer;
    v_submission_id uuid;
BEGIN
    v_window_start := now() - (p_rate_limit_hours || ' hours')::interval;

    -- [SECURITY] Upgrade to 64-bit advisory lock using hashtextextended 
    -- Reduces collision probability at 1M IPs from ~1/2^32 to ~1/2^64
    PERFORM pg_advisory_xact_lock(hashtextextended('rate_limit_' || p_ip_hash, 0));

    -- Check rate limit (transactional & locked)
    -- Hits idx_rate_limits_composite for optimal performance
    SELECT count(*) INTO v_recent_count
    FROM rate_limits
    WHERE ip_hash = p_ip_hash
      AND created_at >= v_window_start;

    IF v_recent_count >= p_rate_limit_max THEN
        RETURN jsonb_build_object('success', false, 'reason', 'rate_limit_exceeded');
    END IF;

    -- [ATOMICITY] Use ON CONFLICT for duplicate handling
    -- Requires UNIQUE index on message_hash (created in migration 001)
    INSERT INTO submissions (message, message_hash, content_type, author_name)
    VALUES (p_message, p_message_hash, p_content_type, COALESCE(p_author_name, 'فاعل خير'))
    ON CONFLICT (message_hash) DO NOTHING
    RETURNING id INTO v_submission_id;

    -- If v_submission_id is NULL, it means the ON CONFLICT triggered
    IF v_submission_id IS NULL THEN
        -- Silent success prevents content probing timing attacks
        RETURN jsonb_build_object('success', true, 'reason', 'duplicate_silent_success');
    END IF;

    -- Record request for rate limiting (atomic with submission)
    INSERT INTO rate_limits (ip_hash) VALUES (p_ip_hash);

    RETURN jsonb_build_object('success', true, 'submission_id', v_submission_id);
END;
$$;

-- Revoke from anon, grant to service_role
REVOKE EXECUTE ON FUNCTION public.submit_post(text, text, text, text, text, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_post(text, text, text, text, text, integer, integer) TO service_role;

-- 2. Fast stats aggregation RPC to prevent OOM
CREATE OR REPLACE FUNCTION public.refresh_community_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_approved bigint;
    v_total_post_count bigint;
    v_average_post_count numeric;
BEGIN
    -- [PERFORMANCE] Aggregation happens entirely in-database to avoid Node.js OOM
    -- Relies on idx_submissions_status (partial index or status index)
    SELECT 
        COUNT(*),
        COALESCE(SUM(post_count), 0),
        CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(post_count), 0)::numeric / COUNT(*) ELSE 0 END
    INTO v_total_approved, v_total_post_count, v_average_post_count
    FROM submissions
    WHERE status IN ('Approved', 'Posted');

    INSERT INTO community_stats (id, total_approved, total_post_count, average_post_count, updated_at)
    VALUES (1, v_total_approved, v_total_post_count, v_average_post_count, now())
    ON CONFLICT (id) DO UPDATE SET
        total_approved = EXCLUDED.total_approved,
        total_post_count = EXCLUDED.total_post_count,
        average_post_count = EXCLUDED.average_post_count,
        updated_at = EXCLUDED.updated_at;

    RETURN jsonb_build_object(
        'total_approved', v_total_approved,
        'total_post_count', v_total_post_count,
        'average_post_count', v_average_post_count
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_community_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.refresh_community_stats() TO service_role;
