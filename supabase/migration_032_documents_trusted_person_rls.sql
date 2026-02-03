-- Migration: Add RLS policies for trusted person document access
-- This migration enables trusted persons with accepted invitations to read owner documents

-- ============================================
-- Documents Table RLS Policies
-- ============================================

-- Enable RLS on documents table (if not already enabled)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to ensure clean state)
DROP POLICY IF EXISTS "Users can read own documents" ON public.documents;
DROP POLICY IF EXISTS "Trusted persons can read owner documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;

-- Policy: Users can read their own documents
CREATE POLICY "Users can read own documents"
ON public.documents FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Trusted persons can read owner documents
-- This allows trusted persons with accepted, active relationships to view documents
CREATE POLICY "Trusted persons can read owner documents"
ON public.documents FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trusted_persons
    WHERE trusted_persons.user_id = documents.user_id
      AND trusted_persons.linked_user_id = auth.uid()
      AND trusted_persons.invitation_status = 'accepted'
      AND trusted_persons.is_active = true
  )
);

-- Policy: Users can insert their own documents
CREATE POLICY "Users can insert own documents"
ON public.documents FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own documents
CREATE POLICY "Users can update own documents"
ON public.documents FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own documents
CREATE POLICY "Users can delete own documents"
ON public.documents FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- Storage Objects RLS Policies (Documents Bucket)
-- ============================================

-- SECURITY NOTE: We intentionally do NOT create an RLS policy for trusted persons
-- on storage.objects. Direct storage access would bypass tier and view-only controls.
-- Instead, trusted persons must use the /api/family/view/stream endpoint which:
-- 1. Verifies the trusted person relationship
-- 2. Checks the owner has a paid subscription (basic or premium)
-- 3. Uses short-lived signed tokens for authorization
-- 4. Streams files inline (view-only) without download capability

-- Remove any existing trusted person storage policy to ensure security
DROP POLICY IF EXISTS "Trusted persons can read owner documents in storage" ON storage.objects;

-- ============================================
-- Performance Optimization: Add Index
-- ============================================

-- Create index on trusted_persons for efficient policy evaluation
-- This composite index covers all the columns used in the RLS policy checks
CREATE INDEX IF NOT EXISTS idx_trusted_persons_rls_check
ON public.trusted_persons (user_id, linked_user_id, invitation_status, is_active)
WHERE invitation_status = 'accepted' AND is_active = true;

-- ============================================
-- Verification Queries (for manual testing)
-- ============================================

-- To verify document policies are created:
-- SELECT * FROM pg_policies WHERE tablename = 'documents';

-- To verify NO storage policy exists for trusted persons (security check):
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%trusted%';
-- (should return empty)

-- To verify index is created:
-- SELECT * FROM pg_indexes WHERE indexname = 'idx_trusted_persons_rls_check';

-- ============================================
-- Rollback Script (if needed)
-- ============================================

-- DROP POLICY IF EXISTS "Trusted persons can read owner documents" ON public.documents;
-- DROP POLICY IF EXISTS "Users can read own documents" ON public.documents;
-- DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
-- DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
-- DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
-- DROP INDEX IF EXISTS idx_trusted_persons_rls_check;
-- Note: Storage policy for trusted persons was intentionally removed for security
