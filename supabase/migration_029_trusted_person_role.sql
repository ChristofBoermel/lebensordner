-- Migration: Add role field to trusted_persons table
-- This allows distinguishing between document owners and family members (viewers)

-- Add role column with default value
ALTER TABLE trusted_persons
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'family_member' CHECK (role IN ('owner', 'family_member'));

-- Update existing records to have 'family_member' role (they are people invited to view documents)
UPDATE trusted_persons SET role = 'family_member' WHERE role IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN trusted_persons.role IS 'Role of the person: owner (has documents) or family_member (viewer only)';
