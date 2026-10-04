-- Remove anonymous writes on the fatiha counter (see issue #138).
-- The anon UPDATE policy let anyone holding the anon key SET the count to
-- an arbitrary value (only count >= 0 was checked). All legitimate traffic
-- goes through the fatiha-counter function, which now uses the
-- service_role-only increment_fatiha_counter() RPC (migration 026).
-- The anon SELECT stays: the count itself is public data.
-- Safe to run multiple times.

DROP POLICY IF EXISTS "Public can increment fatiha counter"
    ON public.fatiha_counter;

REVOKE UPDATE ON public.fatiha_counter FROM anon;
