-- ═══════════════════════════════════════════════════════════════════════════
-- أجر لا ينقطع — Migration 014
-- Phase 2: Engagement, Observability, Cleanup
-- Safe to run multiple times (idempotent)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. ADD PER-TYPE COUNTERS TO memories
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS tasbeeh_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS dua_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS share_count integer NOT NULL DEFAULT 0;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. INDEX: memories(status) for aggregation stats
--    idx_memories_approved already covers WHERE status='Approved' lookups.
--    This new index covers general status-based aggregation.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_memories_status
    ON public.memories(status);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. UPDATED RPC: record_memory_interaction
--    Changes: single UPDATE now increments per-type counter alongside total.
--    Atomic via col = col + CASE pattern. No read-modify-write.
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

    -- Atomic counter increment: total + per-type in single UPDATE
    UPDATE memories
    SET total_interactions = total_interactions + 1,
        tasbeeh_count = tasbeeh_count + CASE WHEN p_interaction_type = 'tasbeeh' THEN 1 ELSE 0 END,
        dua_count     = dua_count     + CASE WHEN p_interaction_type = 'dua'     THEN 1 ELSE 0 END,
        share_count   = share_count   + CASE WHEN p_interaction_type = 'share'   THEN 1 ELSE 0 END,
        last_activity_at = now()
    WHERE id = p_memory_id
    RETURNING total_interactions INTO v_total;

    RETURN jsonb_build_object('recorded', true, 'total_interactions', v_total);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RPC: get_memory_stats (admin aggregation)
--    Single query, no unbounded scan. Uses FILTER for per-status counts.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_memory_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'total',              count(*),
        'pending',            count(*) FILTER (WHERE status = 'Pending'),
        'approved',           count(*) FILTER (WHERE status = 'Approved'),
        'rejected',           count(*) FILTER (WHERE status = 'Rejected'),
        'total_interactions',  COALESCE(sum(total_interactions), 0),
        'total_tasbeeh',       COALESCE(sum(tasbeeh_count), 0),
        'total_dua',           COALESCE(sum(dua_count), 0),
        'total_share',         COALESCE(sum(share_count), 0)
    ) INTO v_result
    FROM memories;

    RETURN v_result;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. RPC: get_submission_stats (replaces count:'exact' queries)
--    Performance guardrail: replaces 3 separate exact-count queries in
--    admin-stats.js with a single aggregation.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_submission_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'pending',  count(*) FILTER (WHERE status = 'Pending'),
        'approved', count(*) FILTER (WHERE status = 'Approved'),
        'rejected', count(*) FILTER (WHERE status = 'Rejected')
    ) INTO v_result
    FROM submissions;

    RETURN v_result;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. RPC: cleanup_memory_interactions
--    Deletes old interaction rows. Does NOT touch total_interactions counter.
--    Called by cleanup-automation.js daily cron.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cleanup_memory_interactions(
    p_older_than_days integer DEFAULT 30
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted integer;
BEGIN
    DELETE FROM memory_interactions
    WHERE created_at < now() - (p_older_than_days || ' days')::interval;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. GRANT / REVOKE
-- ═══════════════════════════════════════════════════════════════════════════

-- record_memory_interaction (updated signature, same permissions)
REVOKE EXECUTE ON FUNCTION public.record_memory_interaction(uuid, text, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_memory_interaction(uuid, text, text, integer) TO service_role;

-- get_memory_stats: service_role only
REVOKE EXECUTE ON FUNCTION public.get_memory_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_memory_stats() TO service_role;

-- get_submission_stats: service_role only
REVOKE EXECUTE ON FUNCTION public.get_submission_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_submission_stats() TO service_role;

-- cleanup_memory_interactions: service_role only
REVOKE EXECUTE ON FUNCTION public.cleanup_memory_interactions(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.cleanup_memory_interactions(integer) TO service_role;
