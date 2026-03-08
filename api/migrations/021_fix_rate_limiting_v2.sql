-- ═══════════════════════════════════════════════════════════════════════════
-- أجر لا ينقطع — Migration 021
-- Fix: Separate rate limit tracking by source (submit vs admin)
-- Root Cause: Admin operations (approve/reject/pending) were polluting the
-- same rate_limits table used by submit_post, causing false 429 for users.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add 'source' column to distinguish submit vs admin rate limit entries
ALTER TABLE public.rate_limits
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'submit';

-- 2. Purge ALL existing rate_limits entries (immediate relief)
--    Old entries are a mix of admin and submit, impossible to separate.
TRUNCATE public.rate_limits;

-- 3. Add composite index that includes source for efficient filtered lookups
DROP INDEX IF EXISTS idx_rate_limits_composite;
CREATE INDEX idx_rate_limits_composite
    ON public.rate_limits (ip_hash, source, created_at DESC);

-- 4. Update submit_post RPC to filter by source = 'submit'
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

    -- Check rate limit — ONLY count 'submit' source entries
    SELECT count(*) INTO v_recent_count
    FROM rate_limits
    WHERE ip_hash = p_ip_hash
      AND source = 'submit'
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

    -- Insert with duplicate detection via UNIQUE constraint
    INSERT INTO submissions (message, message_hash, content_type, author_name)
    VALUES (p_message, p_message_hash, p_content_type, COALESCE(p_author_name, 'فاعل خير'))
    ON CONFLICT (message_hash) DO NOTHING
    RETURNING id INTO v_submission_id;

    IF v_submission_id IS NULL THEN
        RETURN jsonb_build_object('success', true, 'reason', 'duplicate_silent_success');
    END IF;

    -- Record request for rate limiting with source tag
    INSERT INTO rate_limits (ip_hash, source) VALUES (p_ip_hash, 'submit');

    RETURN jsonb_build_object('success', true, 'submission_id', v_submission_id);
END;
$$;

-- 5. Update create_memory RPC to also filter by source = 'memory'
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

-- 6. Re-apply security grants for all RPCs
REVOKE ALL ON FUNCTION public.submit_post(text, text, text, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_post(text, text, text, text, text, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.create_memory(text, text, text, text, text, jsonb, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_memory(text, text, text, text, text, jsonb, text, text, integer, integer) TO service_role;
