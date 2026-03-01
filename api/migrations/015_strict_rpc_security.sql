-- ═══════════════════════════════════════════════════════════════════════════
-- أجر لا ينقطع — Migration 015
-- Strict Security Boundary: Revoke from PUBLIC
-- ═══════════════════════════════════════════════════════════════════════════

-- [CRITICAL] In PostgreSQL, revoking from 'anon' or 'authenticated' is NOT 
-- sufficient if the privilege is granted to 'PUBLIC' (default for functions).
-- We must explicitly revoke from PUBLIC to lock down the boundary.

-- 1. Community Submission RPCs
REVOKE ALL ON FUNCTION public.submit_post(text, text, text, text, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_community_stats() FROM PUBLIC;

-- 2. Memorial Page RPCs
REVOKE ALL ON FUNCTION public.create_memory(text, text, text, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_memory_interaction(uuid, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_memory_stats() FROM PUBLIC;

-- 3. Stats & Admin RPCs
REVOKE ALL ON FUNCTION public.get_submission_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_memory_interactions(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_view_events(integer) FROM PUBLIC;

-- 4. Atomic Counter RPCs
REVOKE ALL ON FUNCTION public.record_and_increment_view(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_post_count(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_goal_progress(date, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_view(uuid) FROM PUBLIC;

-- [VERIFICATION] authenticated role is a member of PUBLIC. 
-- By revoking from PUBLIC, both 'anon' and 'authenticated' are blocked.

-- Re-grant ONLY to service_role (used by Netlify functions)
GRANT EXECUTE ON FUNCTION public.submit_post(text, text, text, text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_community_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.create_memory(text, text, text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_memory_interaction(uuid, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_memory_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_submission_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_memory_interactions(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_view_events(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_and_increment_view(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_post_count(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_goal_progress(date, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_view(uuid) TO service_role;
