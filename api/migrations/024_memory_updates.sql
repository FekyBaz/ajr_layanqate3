-- ═══════════════════════════════════════════════════════════════════════════
-- أجر لا ينقطع — Migration 024
-- Structured Collaborative Editing (memory_updates Table & Upgraded create_memory RPC)
-- Safe to run multiple times (idempotent)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Create memory_updates Table
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.memory_updates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_id uuid NOT NULL REFERENCES public.memories(id) ON DELETE CASCADE,
    proposed_by_name text NOT NULL,
    proposed_by_relation text NOT NULL,
    biography text,
    good_traits text,
    ongoing_charity text,
    external_links jsonb,
    story text,
    status text NOT NULL DEFAULT 'Pending',
    created_by_ip_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    reviewed_at timestamptz,
    CONSTRAINT memory_updates_status_check CHECK (status IN ('Pending', 'Approved', 'Rejected'))
);

-- 2. Indexes
-- ═══════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_memory_updates_pending
    ON public.memory_updates(created_at DESC)
    WHERE status = 'Pending';

CREATE INDEX IF NOT EXISTS idx_memory_updates_memory_id
    ON public.memory_updates(memory_id);

-- 3. Row Level Security (RLS)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.memory_updates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'memory_updates' AND policyname = 'Memory updates service role manage') THEN
        CREATE POLICY "Memory updates service role manage"
            ON public.memory_updates
            FOR ALL
            USING (auth.role() = 'service_role')
            WITH CHECK (auth.role() = 'service_role');
    END IF;
END $$;

-- 4. Upgraded create_memory RPC with p_slug_prefix support
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.create_memory(
    p_deceased_name text,
    p_relation text,
    p_biography text,
    p_good_traits text,
    p_ongoing_charity text,
    p_external_links jsonb,
    p_story text,
    p_ip_hash text,
    p_rate_limit_max integer DEFAULT 3,
    p_rate_limit_hours integer DEFAULT 24,
    p_slug_prefix text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_window_start timestamptz;
    v_recent_count integer;
    v_slug text;
    v_base_slug text;
    v_attempt integer := 0;
    v_max_attempts integer := 5;
    v_memory_id uuid;
BEGIN
    v_window_start := now() - (p_rate_limit_hours || ' hours')::interval;

    -- [SECURITY] 64-bit advisory lock per IP to serialize concurrent requests
    PERFORM pg_advisory_xact_lock(hashtextextended('memory_create_' || p_ip_hash, 0));

    -- Check rate limit — ONLY count 'memory' source entries
    SELECT count(*) INTO v_recent_count
    FROM rate_limits
    WHERE ip_hash = p_ip_hash
      AND source = 'memory'
      AND created_at >= v_window_start;

    IF v_recent_count >= p_rate_limit_max THEN
        RETURN jsonb_build_object('success', false, 'reason', 'rate_limit_exceeded');
    END IF;

    -- [SECURITY] Defensive guards: Hard limits in DB to prevent internal bypass
    IF length(coalesce(p_deceased_name, '')) > 200 THEN
        RETURN jsonb_build_object('success', false, 'reason', 'payload_too_large');
    END IF;
    IF length(coalesce(p_biography, '')) > 2000 THEN
        RETURN jsonb_build_object('success', false, 'reason', 'payload_too_large');
    END IF;
    IF length(coalesce(p_good_traits, '')) > 1000 THEN
        RETURN jsonb_build_object('success', false, 'reason', 'payload_too_large');
    END IF;
    IF length(coalesce(p_ongoing_charity, '')) > 2000 THEN
        RETURN jsonb_build_object('success', false, 'reason', 'payload_too_large');
    END IF;
    IF length(coalesce(p_story, '')) > 4000 THEN
        RETURN jsonb_build_object('success', false, 'reason', 'payload_too_large');
    END IF;

    -- Generate URL-safe slug from prefix or deceased_name
    IF p_slug_prefix IS NOT NULL AND p_slug_prefix <> '' THEN
        v_base_slug := p_slug_prefix;
    ELSE
        v_base_slug := lower(regexp_replace(
            left(trim(p_deceased_name), 30),
            '[^a-z0-9\u0600-\u06FF]+', '-', 'gi'
        ));
        v_base_slug := trim(BOTH '-' FROM v_base_slug);
    END IF;

    IF v_base_slug = '' OR v_base_slug IS NULL THEN
        v_base_slug := 'memory';
    END IF;

    -- Retry loop for slug collision
    LOOP
        v_attempt := v_attempt + 1;
        v_slug := v_base_slug || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);

        IF NOT EXISTS (SELECT 1 FROM memories WHERE slug = v_slug) THEN
            EXIT;
        END IF;

        IF v_attempt >= v_max_attempts THEN
            RETURN jsonb_build_object('success', false, 'reason', 'slug_generation_failed');
        END IF;
    END LOOP;

    -- Insert structured memory
    INSERT INTO memories (
        deceased_name,
        relation,
        biography,
        good_traits,
        ongoing_charity,
        external_links,
        story,
        slug,
        status,
        created_by_ip_hash
    ) VALUES (
        p_deceased_name,
        p_relation,
        p_biography,
        p_good_traits,
        p_ongoing_charity,
        p_external_links,
        p_story,
        v_slug,
        'Pending',
        p_ip_hash
    )
    RETURNING id INTO v_memory_id;

    -- Record request in rate_limits with 'memory' source tag
    INSERT INTO rate_limits (ip_hash, source) VALUES (p_ip_hash, 'memory');

    RETURN jsonb_build_object(
        'success', true,
        'memory_id', v_memory_id,
        'slug', v_slug
    );
END;
$$;

-- 5. Propose Memory Update RPC Function
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.propose_memory_update(
    p_memory_id uuid,
    p_proposed_by_name text,
    p_proposed_by_relation text,
    p_biography text,
    p_good_traits text,
    p_ongoing_charity text,
    p_external_links jsonb,
    p_story text,
    p_ip_hash text,
    p_rate_limit_max integer DEFAULT 5,
    p_rate_limit_hours integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_window_start timestamptz;
    v_recent_count integer;
    v_proposal_id uuid;
    v_memory_exists boolean;
BEGIN
    v_window_start := now() - (p_rate_limit_hours || ' hours')::interval;

    -- [SECURITY] Advisory lock per IP
    PERFORM pg_advisory_xact_lock(hashtextextended('memory_update_' || p_ip_hash, 0));

    -- Check if memory exists and is approved
    SELECT EXISTS(
        SELECT 1 FROM memories WHERE id = p_memory_id AND status = 'Approved'
    ) INTO v_memory_exists;

    IF NOT v_memory_exists THEN
        RETURN jsonb_build_object('success', false, 'reason', 'memory_not_found_or_unapproved');
    END IF;

    -- Check rate limit for updating
    SELECT count(*) INTO v_recent_count
    FROM rate_limits
    WHERE ip_hash = p_ip_hash
      AND source = 'memory_update'
      AND created_at >= v_window_start;

    IF v_recent_count >= p_rate_limit_max THEN
        RETURN jsonb_build_object('success', false, 'reason', 'rate_limit_exceeded');
    END IF;

    -- Defensive guards for proposed content length
    IF length(coalesce(p_proposed_by_name, '')) > 100 OR length(coalesce(p_proposed_by_name, '')) < 3 THEN
        RETURN jsonb_build_object('success', false, 'reason', 'invalid_editor_info');
    END IF;
    IF length(coalesce(p_proposed_by_relation, '')) > 100 OR length(coalesce(p_proposed_by_relation, '')) < 3 THEN
        RETURN jsonb_build_object('success', false, 'reason', 'invalid_editor_info');
    END IF;
    IF length(coalesce(p_biography, '')) > 2000 THEN
        RETURN jsonb_build_object('success', false, 'reason', 'payload_too_large');
    END IF;
    IF length(coalesce(p_good_traits, '')) > 1000 THEN
        RETURN jsonb_build_object('success', false, 'reason', 'payload_too_large');
    END IF;
    IF length(coalesce(p_ongoing_charity, '')) > 2000 THEN
        RETURN jsonb_build_object('success', false, 'reason', 'payload_too_large');
    END IF;
    IF length(coalesce(p_story, '')) > 4000 THEN
        RETURN jsonb_build_object('success', false, 'reason', 'payload_too_large');
    END IF;

    -- Insert proposed update
    INSERT INTO memory_updates (
        memory_id,
        proposed_by_name,
        proposed_by_relation,
        biography,
        good_traits,
        ongoing_charity,
        external_links,
        story,
        status,
        created_by_ip_hash
    ) VALUES (
        p_memory_id,
        p_proposed_by_name,
        p_proposed_by_relation,
        p_biography,
        p_good_traits,
        p_ongoing_charity,
        p_external_links,
        p_story,
        'Pending',
        p_ip_hash
    )
    RETURNING id INTO v_proposal_id;

    -- Record request in rate limits with 'memory_update' source
    INSERT INTO rate_limits (ip_hash, source) VALUES (p_ip_hash, 'memory_update');

    RETURN jsonb_build_object(
        'success', true,
        'proposal_id', v_proposal_id
    );
END;
$$;

-- 6. Re-apply strict security boundaries for functions
-- ═══════════════════════════════════════════════════════════════════════════
REVOKE ALL ON FUNCTION public.create_memory(text, text, text, text, text, jsonb, text, text, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_memory(text, text, text, text, text, jsonb, text, text, integer, integer, text) TO service_role;

REVOKE ALL ON FUNCTION public.propose_memory_update(uuid, text, text, text, text, text, jsonb, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.propose_memory_update(uuid, text, text, text, text, text, jsonb, text, text, integer, integer) TO service_role;
