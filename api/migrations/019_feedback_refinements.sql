-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 019: Feedback Refinements (Deterministic Ordering & New Count)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. REPLACE get_feedback_messages with deterministic ordering and new_count
--    Drop old signature grants first, then recreate
-- ═══════════════════════════════════════════════════════════════════════════
REVOKE ALL ON FUNCTION public.get_feedback_messages(text, integer, integer) FROM PUBLIC;
DROP FUNCTION IF EXISTS public.get_feedback_messages(text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_feedback_messages(
    p_status text DEFAULT NULL,
    p_limit integer DEFAULT 50,
    p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN (
        SELECT jsonb_build_object(
            'data', COALESCE(jsonb_agg(row_to_json(f)), '[]'::jsonb),
            'total', (
                SELECT COUNT(*) FROM feedback_messages
                WHERE (p_status IS NULL OR status = p_status)
            ),
            'new_count', (
                SELECT COUNT(*) FROM feedback_messages
                WHERE status = 'New'
            )
        )
        FROM (
            SELECT id, name, email, message, ip_hash, status, admin_note,
                   created_at, handled_at
            FROM feedback_messages
            WHERE (p_status IS NULL OR status = p_status)
            ORDER BY created_at DESC, id DESC -- Deterministic tiebreaker
            LIMIT p_limit OFFSET p_offset
        ) f
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_feedback_messages(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_feedback_messages(text, integer, integer) TO service_role;

-- 2. Analysis: Ordering & Indexing
-- Explicit ORDER BY created_at DESC, id DESC ensures deterministic results.
-- The existing index idx_feedback_messages_created (created_at DESC) naturally
-- supports this sort. Adding id DESC as tiebreaker is cheap and avoids
-- random fluctuations if multiple messages arrive within the same millisecond.
-- No full table scan is introduced because the filtering by status uses
-- idx_feedback_messages_status, and the un-filtered version uses
-- idx_feedback_messages_created.
-- The new_count is an aggregated COUNT(*) using the index on status.
