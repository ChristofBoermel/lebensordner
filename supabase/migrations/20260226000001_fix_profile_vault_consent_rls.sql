-- Repair grants and RLS policies after schema import to ensure
-- authenticated users and service_role can access critical tables.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- profiles
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_profiles_select_self ON public.profiles;
DROP POLICY IF EXISTS rls_profiles_insert_self ON public.profiles;
DROP POLICY IF EXISTS rls_profiles_update_self ON public.profiles;
DROP POLICY IF EXISTS rls_profiles_service_role ON public.profiles;

CREATE POLICY rls_profiles_select_self
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY rls_profiles_insert_self
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY rls_profiles_update_self
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY rls_profiles_service_role
ON public.profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- user_vault_keys
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_vault_keys TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.user_vault_keys TO service_role;

ALTER TABLE public.user_vault_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_vault_self ON public.user_vault_keys;
DROP POLICY IF EXISTS rls_vault_service_role ON public.user_vault_keys;

CREATE POLICY rls_vault_self
ON public.user_vault_keys
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY rls_vault_service_role
ON public.user_vault_keys
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- consent_ledger
GRANT SELECT, INSERT ON TABLE public.consent_ledger TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.consent_ledger TO service_role;

ALTER TABLE public.consent_ledger ENABLE ROW LEVEL SECURITY;
