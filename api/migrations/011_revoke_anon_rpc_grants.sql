-- ═══════════════════════════════════════════════════════════════════════════
-- أجر لا ينقطع — Migration 011
-- Revoke anon grants on SECURITY_DEFINER RPCs (audit fix H-1)
--
-- These RPCs are only called server-side via supabaseAdmin (service_role).
-- Granting to anon allowed unauthenticated clients to call them directly,
-- enabling stat inflation and view-event deletion.
-- Safe to run multiple times (REVOKE is idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- Revoke existing anon grants
REVOKE EXECUTE ON FUNCTION public.record_and_increment_view(uuid, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_post_count(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_goal_progress(date, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_view(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_view_events(integer) FROM anon;

-- Ensure service_role retains access
GRANT EXECUTE ON FUNCTION public.record_and_increment_view(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_post_count(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_goal_progress(date, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_view(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_view_events(integer) TO service_role;
