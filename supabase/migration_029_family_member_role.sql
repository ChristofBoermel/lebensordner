-- Migration 029: Add role field to trusted_persons for family member permissions
-- Role is used to distinguish between emergency contacts and family members with dashboard access

-- Add role column with default 'emergency_contact' for existing entries
ALTER TABLE trusted_persons 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'emergency_contact';

-- Create enum-like constraint via check constraint (PostgreSQL style)
-- Valid roles: 'emergency_contact', 'family_member'
ALTER TABLE trusted_persons 
DROP CONSTRAINT IF EXISTS trusted_persons_role_check;

ALTER TABLE trusted_persons 
ADD CONSTRAINT trusted_persons_role_check 
CHECK (role IN ('emergency_contact', 'family_member'));

-- Update existing entries with accepted invitations to family_member
-- (assuming they were invited via family dashboard)
UPDATE trusted_persons 
SET role = 'family_member' 
WHERE invitation_status = 'accepted' 
AND linked_user_id IS NOT NULL;

-- Index for faster lookups by role
CREATE INDEX IF NOT EXISTS idx_trusted_persons_role 
ON trusted_persons(role);

-- Update RLS policies for family members
-- Family members should be able to read document metadata but NOT access storage directly

-- Drop existing policies if they conflict
DROP POLICY IF EXISTS "Family members can view owner's documents" ON documents;

-- Allow family members to view document metadata (for the dashboard)
CREATE POLICY "Family members can view owner's documents" 
ON documents FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM trusted_persons tp
    WHERE tp.user_id = documents.user_id
    AND tp.linked_user_id = auth.uid()
    AND tp.invitation_status = 'accepted'
    AND tp.is_active = true
    AND tp.role = 'family_member'
  )
);

-- Storage policies: Family members should NOT have direct storage access
-- They must use server-side signed URLs via API
-- Remove any existing permissive storage policies for family members

COMMENT ON COLUMN trusted_persons.role IS 
'Role of the trusted person: emergency_contact (legacy, emergency access only) or family_member (dashboard access with download permissions based on owner tier)';
