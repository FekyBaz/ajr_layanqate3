-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 017: Feedback Messages (Private Contact Channel)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. TABLE
CREATE TABLE IF NOT EXISTS public.feedback_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text,
    email text,
    message text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 1000),
    ip_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. INDEX
CREATE INDEX IF NOT EXISTS idx_feedback_messages_created
    ON public.feedback_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_messages_ip_hash
    ON public.feedback_messages(ip_hash, created_at DESC);

-- 3. ROW LEVEL SECURITY
ALTER TABLE public.feedback_messages ENABLE ROW LEVEL SECURITY;

-- Only service_role can access (no public read/write)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback_messages' AND policyname = 'Feedback service role manage') THEN
        CREATE POLICY "Feedback service role manage"
            ON public.feedback_messages
            FOR ALL
            USING (auth.role() = 'service_role')
            WITH CHECK (auth.role() = 'service_role');
    END IF;
END $$;

-- 4. RPC: submit_feedback
CREATE OR REPLACE FUNCTION public.submit_feedback(
    p_name text DEFAULT NULL,
    p_email text DEFAULT NULL,
    p_message text DEFAULT '',
    p_ip_hash text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_recent_count integer;
BEGIN
    -- Rate limit: 3 per IP per 24h
    SELECT COUNT(*) INTO v_recent_count
    FROM feedback_messages
    WHERE ip_hash = p_ip_hash
      AND created_at >= (now() - interval '24 hours');

    IF v_recent_count >= 3 THEN
        RETURN jsonb_build_object('success', false, 'error', 'rate_limited');
    END IF;

    -- Validate message length
    IF char_length(p_message) < 10 OR char_length(p_message) > 1000 THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_length');
    END IF;

    -- Insert
    INSERT INTO feedback_messages (name, email, message, ip_hash)
    VALUES (
        NULLIF(trim(p_name), ''),
        NULLIF(trim(p_email), ''),
        trim(p_message),
        p_ip_hash
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. RPC: get_feedback_messages (admin only)
CREATE OR REPLACE FUNCTION public.get_feedback_messages(
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
            'total', (SELECT COUNT(*) FROM feedback_messages)
        )
        FROM (
            SELECT id, name, email, message, created_at
            FROM feedback_messages
            ORDER BY created_at DESC
            LIMIT p_limit OFFSET p_offset
        ) f
    );
END;
$$;

-- 6. PERMISSIONS: lock down
REVOKE ALL ON FUNCTION public.submit_feedback(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_feedback(text, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.get_feedback_messages(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_feedback_messages(integer, integer) TO service_role;
