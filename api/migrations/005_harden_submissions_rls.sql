-- Harden submissions table RLS for production
-- Safe to run multiple times

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions FORCE ROW LEVEL SECURITY;

-- Keep anonymous writes restricted to pending submissions only
DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.submissions;
CREATE POLICY "Allow anonymous inserts" ON public.submissions
    FOR INSERT
    TO anon
    WITH CHECK (
        message IS NOT NULL
        AND content_type IS NOT NULL
        AND corrected_message IS NULL
        AND status = 'Pending'
        AND reviewed_at IS NULL
    );

-- Anonymous users may only read approved records
DROP POLICY IF EXISTS "Public approved read only" ON public.submissions;
CREATE POLICY "Public approved read only" ON public.submissions
    FOR SELECT
    TO anon
    USING (status = 'Approved');

-- Service role keeps full backend automation access
DROP POLICY IF EXISTS "Service role full access" ON public.submissions;
CREATE POLICY "Service role full access" ON public.submissions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
