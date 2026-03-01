-- ═══════════════════════════════════════════════════════════════════════════
-- أجر لا ينقطع — Migration 016
-- Phase 3: Structured Memories (Legacy Hub)
-- Safe to run multiple times (idempotent)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. ADD STRUCTURED FIELDS
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS biography text;
ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS good_traits text;
ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS ongoing_charity text;
ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS external_links jsonb;
ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS story text;

-- 2. MAKE OLD MESSAGE FIELD NULLABLE
-- ═══════════════════════════════════════════════════════════════════════════
-- The old free-form message is superseded by the biography/story structure.
-- We keep the column for legacy records but remove the NOT NULL constraint for new ones.
ALTER TABLE public.memories ALTER COLUMN message DROP NOT NULL;

-- 3. UPDATE create_memory RPC
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
    v_slug text;
    v_base_slug text;
    v_attempt integer := 0;
    v_max_attempts integer := 5;
    v_memory_id uuid;
BEGIN
    v_window_start := now() - (p_rate_limit_hours || ' hours')::interval;

    -- [SECURITY] 64-bit advisory lock per IP to serialize concurrent requests
    PERFORM pg_advisory_xact_lock(hashtextextended('memory_create_' || p_ip_hash, 0));

    -- Check rate limit (transactional & locked)
    SELECT count(*) INTO v_recent_count
    FROM rate_limits
    WHERE ip_hash = p_ip_hash
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

    -- Generate URL-safe slug from deceased_name + random suffix
    v_base_slug := lower(regexp_replace(
        left(trim(p_deceased_name), 30),
        '[^a-z0-9\u0600-\u06FF]+', '-', 'gi'
    ));
    v_base_slug := trim(BOTH '-' FROM v_base_slug);
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
    -- Note: 'message' is left NULL for new records. Legacy UI fallback will handle it.
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

    -- Record request in rate_limits (atomic with memory creation)
    INSERT INTO rate_limits (ip_hash) VALUES (p_ip_hash);

    RETURN jsonb_build_object(
        'success', true,
        'memory_id', v_memory_id,
        'slug', v_slug
    );
END;
$$;

-- 4. RE-APPLY STRICT PERMISSION BOUNDARY
-- ═══════════════════════════════════════════════════════════════════════════
REVOKE ALL ON FUNCTION public.create_memory(text, text, text, text, text, jsonb, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_memory(text, text, text, text, text, jsonb, text, text, integer, integer) TO service_role;
