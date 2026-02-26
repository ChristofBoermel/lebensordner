-- Hotfix: restore grants/RLS for E2EE sharing tables and storage.objects policies.
-- Safe/idempotent: drops/recreates policies and reapplies grants.

BEGIN;

-- E2EE/share table grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_vault_keys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_relationship_keys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_share_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.download_link_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.download_link_wrapped_deks TO authenticated;

GRANT ALL PRIVILEGES ON public.user_vault_keys TO service_role;
GRANT ALL PRIVILEGES ON public.document_relationship_keys TO service_role;
GRANT ALL PRIVILEGES ON public.document_share_tokens TO service_role;
GRANT ALL PRIVILEGES ON public.download_link_documents TO service_role;
GRANT ALL PRIVILEGES ON public.download_link_wrapped_deks TO service_role;

-- Ensure RLS is enabled
ALTER TABLE public.user_vault_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_relationship_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_share_tokens ENABLE ROW LEVEL SECURITY;

-- user_vault_keys policies
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

-- document_relationship_keys policies
DROP POLICY IF EXISTS relationship_keys_owner ON public.document_relationship_keys;
DROP POLICY IF EXISTS relationship_keys_tp_select ON public.document_relationship_keys;

CREATE POLICY relationship_keys_owner
ON public.document_relationship_keys
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY relationship_keys_tp_select
ON public.document_relationship_keys
FOR SELECT
TO authenticated
USING (
  trusted_person_id IN (
    SELECT id
    FROM public.trusted_persons
    WHERE linked_user_id = auth.uid()
  )
);

-- document_share_tokens policies
DROP POLICY IF EXISTS share_tokens_owner_manage ON public.document_share_tokens;
DROP POLICY IF EXISTS share_tokens_tp_select ON public.document_share_tokens;

CREATE POLICY share_tokens_owner_manage
ON public.document_share_tokens
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY share_tokens_tp_select
ON public.document_share_tokens
FOR SELECT
TO authenticated
USING (
  trusted_person_id IN (
    SELECT id
    FROM public.trusted_persons
    WHERE linked_user_id = auth.uid()
  )
  AND revoked_at IS NULL
  AND (expires_at IS NULL OR expires_at > now())
);

-- Storage RLS for documents/avatars
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Trusted persons can read owner documents in storage" ON storage.objects;

CREATE POLICY "Users can read own documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can upload own documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public can view avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

COMMIT;
