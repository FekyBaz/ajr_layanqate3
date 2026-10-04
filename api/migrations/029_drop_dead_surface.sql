-- Drop dead attack surface (see issue #139).
-- 1. Superseded create_memory signatures (live: 024, 11 args). The old ones
--    are locked to service_role today, but dead code with old validation
--    must not survive a future grant mistake.
-- 2. Stale `authenticated`-role policies from 002 (the app has no Supabase
--    Auth; admin works via API key). An allow-all UPDATE under USING(true)
--    must not linger.
-- 3. Duplicate public SELECT on submissions (keep 007 "Public visible
--    read only" as the single source).
-- Safe to run multiple times.

DROP FUNCTION IF EXISTS
    public.create_memory(text, text, text, text, integer, integer);

DROP FUNCTION IF EXISTS
    public.create_memory(text, text, text, text, text, jsonb, text, text, integer, integer);

DROP POLICY IF EXISTS "Admin read access" ON public.submissions;
DROP POLICY IF EXISTS "Admin update limited" ON public.submissions;
DROP POLICY IF EXISTS "Submissions public visible read" ON public.submissions;
