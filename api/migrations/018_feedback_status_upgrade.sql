-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 018: Feedback Status Upgrade + Admin Actions
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. ADD COLUMNS (safe — no rewrite, no lock on existing data)
ALTER TABLE public.feedback_messages
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'New',
    ADD COLUMN IF NOT EXISTS handled_at timestamptz,
    ADD COLUMN IF NOT EXISTS admin_note text;

-- 2. ADD CONSTRAINT
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'feedback_messages'
          AND constraint_name = 'feedback_status_check'
    ) THEN
        ALTER TABLE public.feedback_messages
            ADD CONSTRAINT feedback_status_check
            CHECK (status IN ('New', 'In Progress', 'Resolved', 'Archived'));
    END IF;
END $$;

-- 3. INDEX on status for filtered queries
CREATE INDEX IF NOT EXISTS idx_feedback_messages_status
    ON public.feedback_messages(status, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RPC: update_feedback_status (admin action)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_feedback_status(
    p_id uuid,
    p_status text,
    p_admin_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Validate status
    IF p_status NOT IN ('New', 'In Progress', 'Resolved', 'Archived') THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_status');
    END IF;

    UPDATE feedback_messages
    SET status = p_status,
        handled_at = CASE WHEN p_status != 'New' THEN now() ELSE NULL END,
        admin_note = COALESCE(NULLIF(trim(p_admin_note), ''), admin_note)
    WHERE id = p_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_found');
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.update_feedback_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_feedback_status(uuid, text, text) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. REPLACE get_feedback_messages with status filter support
--    Drop old signature grants first, then recreate
-- ═══════════════════════════════════════════════════════════════════════════
REVOKE ALL ON FUNCTION public.get_feedback_messages(integer, integer) FROM PUBLIC;
DROP FUNCTION IF EXISTS public.get_feedback_messages(integer, integer);

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
            )
        )
        FROM (
            SELECT id, name, email, message, ip_hash, status, admin_note,
                   created_at, handled_at
            FROM feedback_messages
            WHERE (p_status IS NULL OR status = p_status)
            ORDER BY created_at DESC
            LIMIT p_limit OFFSET p_offset
        ) f
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_feedback_messages(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_feedback_messages(text, integer, integer) TO service_role;
