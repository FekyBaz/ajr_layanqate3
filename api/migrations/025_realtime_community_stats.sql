-- ═══════════════════════════════════════════════════════════════════════════
-- أجر لا ينقطع — Migration 025
-- Realtime Community Stats Counter Sync
-- ═══════════════════════════════════════════════════════════════════════════

-- Optimize increment_post_count to also update community_stats in real-time
CREATE OR REPLACE FUNCTION public.increment_post_count(p_submission_id uuid)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
DECLARE
    v_new_post_count integer;
BEGIN
    UPDATE public.submissions
    SET post_count = post_count + 1,
        last_posted_at = now()
    WHERE id = p_submission_id
      AND status IN ('Approved', 'Posted')
    RETURNING post_count INTO v_new_post_count;

    IF v_new_post_count IS NOT NULL THEN
        UPDATE public.community_stats
        SET total_post_count = total_post_count + 1,
            updated_at = now()
        WHERE id = 1;
    END IF;

    RETURN v_new_post_count;
END;
$$;

-- Grant execute permission to service_role
REVOKE ALL ON FUNCTION public.increment_post_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_post_count(uuid) TO service_role;
