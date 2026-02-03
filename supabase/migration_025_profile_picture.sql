-- Migration 025: Add profile picture support and storage bucket configuration
-- This migration:
-- 1. Adds profile_picture_url column to profiles table
-- 2. Creates storage buckets for documents (private) and avatars (public)
-- 3. Sets up RLS policies for secure file access
--
-- Security Model:
-- - All files are stored with path structure: {user_id}/{path}/{timestamp}_{filename}
-- - User ownership is verified by checking if the file path starts with auth.uid()
-- - Documents bucket: Private - only authenticated owners can access their files
-- - Avatars bucket: Public read - anyone can view, but only owners can modify

-- ============================================================================
-- STEP 1: Add profile picture URL column
-- ============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

COMMENT ON COLUMN public.profiles.profile_picture_url IS 'URL to the user profile picture in storage';

-- ============================================================================
-- STEP 2: Create storage buckets
-- ============================================================================

-- Create documents bucket (private - for user documents)
-- Files in this bucket require authentication and ownership verification
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create avatars bucket (public read - for profile pictures)
-- Anyone can view avatars, but only owners can upload/modify/delete
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 2.5: Enable RLS on storage.objects (if not already enabled)
-- ============================================================================
-- RLS must be enabled on the table for policies to take effect

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'storage'
        AND c.relname = 'objects'
        AND c.relrowsecurity = true
    ) THEN
        ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- ============================================================================
-- STEP 3: RLS Policies for DOCUMENTS bucket (private)
-- ============================================================================
-- All policies verify ownership by checking if the file path starts with the user's ID
-- Path structure: {user_id}/documents/{timestamp}_{filename}

-- Allow authenticated users to read their own documents
CREATE POLICY "Users can read own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to upload documents to their own folder
CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own documents (for upsert functionality)
CREATE POLICY "Users can update own documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own documents
CREATE POLICY "Users can delete own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- STEP 4: RLS Policies for AVATARS bucket (public read, authenticated write)
-- ============================================================================
-- Public can view all avatars (for displaying profile pictures)
-- Only owners can upload/modify/delete their own avatars
-- Path structure: {user_id}/{timestamp}_{filename}

-- Allow public read access to all avatars (no authentication required)
CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Allow authenticated users to upload avatars to their own folder
CREATE POLICY "Users can upload own avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own avatars
CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own avatars
CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
);
