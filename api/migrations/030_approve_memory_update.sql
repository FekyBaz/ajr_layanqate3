-- Atomic approve-and-merge for memory update proposals (see issue #156).
-- Previously the function updated memories, then memory_updates, in two
-- round trips: if the second failed, merged content showed while the
-- proposal stayed Pending forever. One transaction now covers both.
-- Length guards mirror the function-side sanitization caps.
-- Safe to run multiple times.

CREATE OR REPLACE FUNCTION public.approve_memory_update(
    p_proposal_id uuid,
    p_biography text,
    p_good_traits text,
    p_ongoing_charity text,
    p_external_links jsonb,
    p_story text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_memory_id uuid;
BEGIN
    -- Lock the pending proposal row first
    SELECT memory_id INTO v_memory_id
    FROM memory_updates
    WHERE id = p_proposal_id AND status = 'Pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'reason', 'not_found_or_reviewed');
    END IF;

    -- Defensive length guards (function sanitizes first; DB enforces)
    IF length(coalesce(p_biography, '')) > 1000
        OR length(coalesce(p_good_traits, '')) > 500
        OR length(coalesce(p_ongoing_charity, '')) > 1000
        OR length(coalesce(p_story, '')) > 4000 THEN
        RETURN jsonb_build_object('success', false, 'reason', 'payload_too_large');
    END IF;

    UPDATE memories
    SET biography = p_biography,
        good_traits = p_good_traits,
        ongoing_charity = p_ongoing_charity,
        external_links = p_external_links,
        story = p_story,
        last_activity_at = now()
    WHERE id = v_memory_id;

    UPDATE memory_updates
    SET status = 'Approved',
        reviewed_at = now(),
        biography = p_biography,
        good_traits = p_good_traits,
        ongoing_charity = p_ongoing_charity,
        external_links = p_external_links,
        story = p_story
    WHERE id = p_proposal_id;

    RETURN jsonb_build_object('success', true, 'memory_id', v_memory_id);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_memory_update(uuid, text, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_memory_update(uuid, text, text, text, jsonb, text) TO service_role;
