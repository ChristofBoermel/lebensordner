-- Repair grants and RLS policies for vaccinations and audit log endpoints
-- after manual schema import/recovery operations.

-- vaccinations
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vaccinations TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.vaccinations TO service_role;

ALTER TABLE public.vaccinations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vaccinations_owner ON public.vaccinations;
DROP POLICY IF EXISTS vaccinations_select_own ON public.vaccinations;
DROP POLICY IF EXISTS vaccinations_insert_own ON public.vaccinations;
DROP POLICY IF EXISTS vaccinations_update_own ON public.vaccinations;
DROP POLICY IF EXISTS vaccinations_delete_own ON public.vaccinations;
DROP POLICY IF EXISTS vaccinations_service_role ON public.vaccinations;

CREATE POLICY vaccinations_select_own
ON public.vaccinations
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY vaccinations_insert_own
ON public.vaccinations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY vaccinations_update_own
ON public.vaccinations
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY vaccinations_delete_own
ON public.vaccinations
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY vaccinations_service_role
ON public.vaccinations
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- security_audit_log
GRANT SELECT ON TABLE public.security_audit_log TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.security_audit_log TO service_role;

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own audit records" ON public.security_audit_log;
DROP POLICY IF EXISTS "Service role can insert audit records" ON public.security_audit_log;
DROP POLICY IF EXISTS "Service role can read all audit records" ON public.security_audit_log;
DROP POLICY IF EXISTS "Service role can update audit records" ON public.security_audit_log;
DROP POLICY IF EXISTS "Service role can delete audit records" ON public.security_audit_log;
DROP POLICY IF EXISTS security_audit_log_select_own ON public.security_audit_log;
DROP POLICY IF EXISTS security_audit_log_service_role_all ON public.security_audit_log;

CREATE POLICY security_audit_log_select_own
ON public.security_audit_log
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY security_audit_log_service_role_all
ON public.security_audit_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
