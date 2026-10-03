-- Atomic fatiha counter increment (see issue #110)
-- Replaces the read-modify-write cycle in the fatiha-counter function,
-- which loses increments under concurrent POSTs.
-- Safe to run multiple times.

CREATE OR REPLACE FUNCTION public.increment_fatiha_counter()
RETURNS integer
LANGUAGE sql
VOLATILE
SECURITY DEFINER
AS $$
    UPDATE public.fatiha_counter
    SET count = count + 1
    WHERE id = 1
    RETURNING count;
$$;

-- Lock down the boundary (same convention as 015_strict_rpc_security.sql):
-- revoke from PUBLIC (covers anon + authenticated), grant to service_role only.
REVOKE ALL ON FUNCTION public.increment_fatiha_counter() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_fatiha_counter() TO service_role;
