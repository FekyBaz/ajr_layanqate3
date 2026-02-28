-- ═══════════════════════════════════════════════════════════════════════════
-- أجر لا ينقطع — Migration 013
-- صدقة جارية على روح متوفى: Tables, Indexes, RLS, and RPC Functions
-- Safe to run multiple times (idempotent)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- memories: each row is a memorial page for a deceased person
CREATE TABLE IF NOT EXISTS public.memories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL,
    deceased_name text NOT NULL,
    relation text,
    message text NOT NULL,
    status text NOT NULL DEFAULT 'Pending',
    created_at timestamptz NOT NULL DEFAULT now(),
    approved_at timestamptz,
    created_by_ip_hash text NOT NULL,
    total_interactions integer NOT NULL DEFAULT 0,
    last_activity_at timestamptz,
    CONSTRAINT memories_status_check CHECK (status IN ('Pending', 'Approved', 'Rejected'))
);

-- memory_interactions: every tasbeeh/dua/share action
CREATE TABLE IF NOT EXISTS public.memory_interactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_id uuid NOT NULL REFERENCES public.memories(id) ON DELETE CASCADE,
    interaction_type text NOT NULL,
    ip_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT memory_interactions_type_check CHECK (interaction_type IN ('tasbeeh', 'dua', 'share'))
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. INDEXES
-- ═══════════════════════════════════════════════════════════════════════════

-- Unique slug for URL routing
CREATE UNIQUE INDEX IF NOT EXISTS idx_memories_slug
    ON public.memories(slug);

-- Fast lookup of approved memories (public pages)
CREATE INDEX IF NOT EXISTS idx_memories_approved
    ON public.memories(created_at DESC)
    WHERE status = 'Approved';

-- Interaction lookup for dedup checks (ip + memory + time)
CREATE INDEX IF NOT EXISTS idx_memory_interactions_dedup
    ON public.memory_interactions(memory_id, ip_hash, created_at DESC);

-- Interaction timeline per memory
CREATE INDEX IF NOT EXISTS idx_memory_interactions_memory_created
    ON public.memory_interactions(memory_id, created_at DESC);

-- Rate limit lookups per IP on interactions
CREATE INDEX IF NOT EXISTS idx_memory_interactions_ip_created
    ON public.memory_interactions(ip_hash, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_interactions ENABLE ROW LEVEL SECURITY;

-- memories: public can only read approved
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'memories' AND policyname = 'Memories public approved read') THEN
        CREATE POLICY "Memories public approved read"
            ON public.memories
            FOR SELECT
            USING (status = 'Approved');
    END IF;
END $$;

-- memories: service_role full access
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'memories' AND policyname = 'Memories service role manage') THEN
        CREATE POLICY "Memories service role manage"
            ON public.memories
            FOR ALL
            USING (auth.role() = 'service_role')
            WITH CHECK (auth.role() = 'service_role');
    END IF;
END $$;

-- memory_interactions: service_role only (no public access at all)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'memory_interactions' AND policyname = 'Memory interactions service role manage') THEN
        CREATE POLICY "Memory interactions service role manage"
            ON public.memory_interactions
            FOR ALL
            USING (auth.role() = 'service_role')
            WITH CHECK (auth.role() = 'service_role');
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RPC: create_memory
-- ═══════════════════════════════════════════════════════════════════════════
-- Transactional memory creation with:
--   - 64-bit advisory lock per IP (prevents rate-limit bypass race condition)
--   - Rate limit check against rate_limits table
--   - Slug generation with collision retry
--   - Atomic rate_limits recording
--
-- Race condition prevention:
--   pg_advisory_xact_lock serializes all create_memory calls from the same IP.
--   The rate limit check + insert happens inside this lock, so concurrent
--   requests from the same IP cannot both pass the rate check.
--
-- IP hash generation:
--   Done in the Netlify function layer: SHA-256(raw_ip + IP_SALT).substring(0,32)
--   The RPC receives the pre-hashed value — never sees raw IPs.
--
-- Direct REST abuse prevention:
--   REVOKE EXECUTE FROM anon — the anon key cannot call this RPC at all.
--   Only service_role (used by supabaseAdmin in Netlify functions) can invoke it.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_memory(
    p_deceased_name text,
    p_relation text,
    p_message text,
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

    -- Generate URL-safe slug from deceased_name + random suffix
    -- Base slug: first 30 chars of name, spaces → dashes, lowercase
    v_base_slug := lower(regexp_replace(
        left(trim(p_deceased_name), 30),
        '[^a-z0-9\u0600-\u06FF]+', '-', 'gi'
    ));
    -- Remove leading/trailing dashes
    v_base_slug := trim(BOTH '-' FROM v_base_slug);
    -- Fallback if slug is empty
    IF v_base_slug = '' OR v_base_slug IS NULL THEN
        v_base_slug := 'memory';
    END IF;

    -- Retry loop for slug collision (up to 5 attempts)
    LOOP
        v_attempt := v_attempt + 1;
        -- Append 6-char random hex suffix
        v_slug := v_base_slug || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);

        -- Check uniqueness
        IF NOT EXISTS (SELECT 1 FROM memories WHERE slug = v_slug) THEN
            EXIT; -- unique slug found
        END IF;

        IF v_attempt >= v_max_attempts THEN
            RETURN jsonb_build_object('success', false, 'reason', 'slug_generation_failed');
        END IF;
    END LOOP;

    -- Insert the memory
    INSERT INTO memories (deceased_name, relation, message, slug, status, created_by_ip_hash)
    VALUES (p_deceased_name, p_relation, p_message, v_slug, 'Pending', p_ip_hash)
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. RPC: record_memory_interaction
-- ═══════════════════════════════════════════════════════════════════════════
-- Atomic interaction recording with:
--   - Memory existence + approval check
--   - Dedup within debounce window (per IP, per memory)
--   - Counter increment via UPDATE ... SET total_interactions = total_interactions + 1
--   - No read-modify-write pattern
--
-- Race condition prevention:
--   The UPDATE uses atomic increment (col = col + 1), which is safe under
--   concurrent access in PostgreSQL. The dedup check + insert + update all
--   happen in a single transaction, ensuring consistency.
--
-- Abuse prevention:
--   - Debounce: same IP cannot record same interaction type on same memory
--     within p_debounce_seconds (default 30s)
--   - REVOKE from anon: only callable via service_role
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.record_memory_interaction(
    p_memory_id uuid,
    p_interaction_type text,
    p_ip_hash text,
    p_debounce_seconds integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cutoff timestamptz;
    v_exists boolean;
    v_total integer;
    v_memory_status text;
BEGIN
    -- Validate interaction type
    IF p_interaction_type NOT IN ('tasbeeh', 'dua', 'share') THEN
        RETURN jsonb_build_object('recorded', false, 'reason', 'invalid_type');
    END IF;

    -- Check memory exists and is approved
    SELECT status INTO v_memory_status
    FROM memories
    WHERE id = p_memory_id;

    IF v_memory_status IS NULL THEN
        RETURN jsonb_build_object('recorded', false, 'reason', 'not_found');
    END IF;

    IF v_memory_status <> 'Approved' THEN
        RETURN jsonb_build_object('recorded', false, 'reason', 'not_approved');
    END IF;

    -- Dedup check: same IP + same memory + same type within debounce window
    v_cutoff := now() - (p_debounce_seconds || ' seconds')::interval;

    SELECT EXISTS(
        SELECT 1 FROM memory_interactions
        WHERE memory_id = p_memory_id
          AND ip_hash = p_ip_hash
          AND interaction_type = p_interaction_type
          AND created_at > v_cutoff
    ) INTO v_exists;

    IF v_exists THEN
        RETURN jsonb_build_object('recorded', false, 'reason', 'debounced');
    END IF;

    -- Insert interaction record
    INSERT INTO memory_interactions (memory_id, interaction_type, ip_hash)
    VALUES (p_memory_id, p_interaction_type, p_ip_hash);

    -- Atomic counter increment + update last activity
    UPDATE memories
    SET total_interactions = total_interactions + 1,
        last_activity_at = now()
    WHERE id = p_memory_id
    RETURNING total_interactions INTO v_total;

    RETURN jsonb_build_object('recorded', true, 'total_interactions', v_total);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. GRANT / REVOKE
-- ═══════════════════════════════════════════════════════════════════════════

-- create_memory: service_role only
REVOKE EXECUTE ON FUNCTION public.create_memory(text, text, text, text, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_memory(text, text, text, text, integer, integer) TO service_role;

-- record_memory_interaction: service_role only
REVOKE EXECUTE ON FUNCTION public.record_memory_interaction(uuid, text, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_memory_interaction(uuid, text, text, integer) TO service_role;
