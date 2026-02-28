-- ═══════════════════════════════════════════════════════════════════════════
-- أجر لا ينقطع — Migration 012
-- Critical fixes: Atomic submit and fast stats aggregation
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Atomic sumbit RPC to prevent race condition bypassing rate limits
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
AS $$
DECLARE
    v_window_start timestamptz;
    v_recent_count integer;
    v_exists boolean;
    v_submission_id uuid;
BEGIN
    v_window_start := now() - (p_rate_limit_hours || ' hours')::interval;

    -- Use advisory lock to prevent concurrent requests from the same IP
    -- hashtext converts string to integer for the lock ID
    PERFORM pg_advisory_xact_lock(hashtext('rate_limit_' || p_ip_hash));

    -- Check rate limit
    SELECT count(*) INTO v_recent_count
    FROM public.rate_limits
    WHERE ip_hash = p_ip_hash
      AND created_at >= v_window_start;

    IF v_recent_count >= p_rate_limit_max THEN
        RETURN jsonb_build_object('success', false, 'reason', 'rate_limit_exceeded');
    END IF;

    -- Check duplicate message
    SELECT EXISTS(
        SELECT 1 FROM public.submissions
        WHERE message_hash = p_message_hash
    ) INTO v_exists;

    IF v_exists THEN
        -- Silent success to prevent probing
        RETURN jsonb_build_object('success', true, 'reason', 'duplicate_silent_success');
    END IF;

    -- Insert submission
    IF p_author_name IS NOT NULL THEN
        INSERT INTO public.submissions (message, message_hash, content_type, author_name)
        VALUES (p_message, p_message_hash, p_content_type, p_author_name)
        RETURNING id INTO v_submission_id;
    ELSE
        INSERT INTO public.submissions (message, message_hash, content_type)
        VALUES (p_message, p_message_hash, p_content_type)
        RETURNING id INTO v_submission_id;
    END IF;

    -- Record request for rate limiting
    INSERT INTO public.rate_limits (ip_hash) VALUES (p_ip_hash);

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
AS $$
DECLARE
    v_total_approved bigint;
    v_total_post_count bigint;
    v_average_post_count numeric;
BEGIN
    SELECT 
        COUNT(*),
        COALESCE(SUM(post_count), 0),
        CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(post_count), 0)::numeric / COUNT(*) ELSE 0 END
    INTO v_total_approved, v_total_post_count, v_average_post_count
    FROM public.submissions
    WHERE status IN ('Approved', 'Posted');

    INSERT INTO public.community_stats (id, total_approved, total_post_count, average_post_count, updated_at)
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
