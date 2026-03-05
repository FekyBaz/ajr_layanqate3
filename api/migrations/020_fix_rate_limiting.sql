-- ═══════════════════════════════════════════════════════════════════════════
-- أجر لا ينقطع — Migration 020
-- Fix rate limiting: Include count in response + cleanup stale entries
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Clean ALL old rate_limit entries (reset the counter)
DELETE FROM public.rate_limits
WHERE created_at < now() - interval '24 hours';

-- 2. Update submit_post RPC to include count in rate_limit_exceeded response
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

    -- [SECURITY] 64-bit advisory lock to prevent race conditions
    PERFORM pg_advisory_xact_lock(hashtextextended('rate_limit_' || p_ip_hash, 0));

    -- Check rate limit (transactional & locked)
    SELECT count(*) INTO v_recent_count
    FROM rate_limits
    WHERE ip_hash = p_ip_hash
      AND created_at >= v_window_start;

    IF v_recent_count >= p_rate_limit_max THEN
        RETURN jsonb_build_object(
            'success', false,
            'reason', 'rate_limit_exceeded',
            'current_count', v_recent_count,
            'max_allowed', p_rate_limit_max,
            'window_hours', p_rate_limit_hours
        );
    END IF;

    -- [ATOMICITY] Use ON CONFLICT for duplicate handling
    INSERT INTO submissions (message, message_hash, content_type, author_name)
    VALUES (p_message, p_message_hash, p_content_type, COALESCE(p_author_name, 'فاعل خير'))
    ON CONFLICT (message_hash) DO NOTHING
    RETURNING id INTO v_submission_id;

    IF v_submission_id IS NULL THEN
        RETURN jsonb_build_object('success', true, 'reason', 'duplicate_silent_success');
    END IF;

    -- Record request for rate limiting (atomic with submission)
    INSERT INTO rate_limits (ip_hash) VALUES (p_ip_hash);

    RETURN jsonb_build_object('success', true, 'submission_id', v_submission_id);
END;
$$;

-- Re-apply security grants
REVOKE ALL ON FUNCTION public.submit_post(text, text, text, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_post(text, text, text, text, text, integer, integer) TO service_role;
