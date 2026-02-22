-- Expand anon read visibility to approved + posted submissions
-- Safe to run multiple times

DROP POLICY IF EXISTS "Public approved read only" ON public.submissions;
DROP POLICY IF EXISTS "Public visible read only" ON public.submissions;

CREATE POLICY "Public visible read only" ON public.submissions
    FOR SELECT
    TO anon
    USING (status IN ('Approved', 'Posted'));
