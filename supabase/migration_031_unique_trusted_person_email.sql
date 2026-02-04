-- Migration: Unique trusted person email per user
-- This migration ensures each user cannot add the same email as a trusted person multiple times.
-- Before creating the unique index, we must clean up any existing duplicates.

-- Step 1: Create a temporary table to identify duplicates
-- For each user+email combo with multiple active records, keep only the most recent one
DO $$
DECLARE
    duplicate_record RECORD;
    kept_id UUID;
BEGIN
    -- Find all user+email combinations that have duplicates among active records
    FOR duplicate_record IN
        SELECT user_id, LOWER(email) as email_lower, COUNT(*) as cnt
        FROM trusted_persons
        WHERE is_active = true
        GROUP BY user_id, LOWER(email)
        HAVING COUNT(*) > 1
    LOOP
        -- For each duplicate group, keep the most recent one (by updated_at, then created_at)
        -- and deactivate the others
        SELECT id INTO kept_id
        FROM trusted_persons
        WHERE user_id = duplicate_record.user_id
          AND LOWER(email) = duplicate_record.email_lower
          AND is_active = true
        ORDER BY
            -- Prefer records that have been accepted
            CASE WHEN invitation_status = 'accepted' THEN 0 ELSE 1 END,
            -- Then prefer records with linked users
            CASE WHEN linked_user_id IS NOT NULL THEN 0 ELSE 1 END,
            -- Then prefer most recently updated
            updated_at DESC NULLS LAST,
            created_at DESC NULLS LAST
        LIMIT 1;

        -- Deactivate all other duplicates (keep audit trail rather than deleting)
        UPDATE trusted_persons
        SET is_active = false,
            notes = COALESCE(notes, '') || ' [Deactivated by migration: duplicate email]',
            updated_at = NOW()
        WHERE user_id = duplicate_record.user_id
          AND LOWER(email) = duplicate_record.email_lower
          AND is_active = true
          AND id != kept_id;

        RAISE NOTICE 'Resolved duplicates for user % email %: kept %, deactivated others',
            duplicate_record.user_id, duplicate_record.email_lower, kept_id;
    END LOOP;
END $$;

-- Step 2: Create the unique index (will succeed now that duplicates are resolved)
CREATE UNIQUE INDEX IF NOT EXISTS unique_trusted_person_email_per_user
ON trusted_persons(user_id, LOWER(email))
WHERE is_active = true;

-- Add comment for documentation
COMMENT ON INDEX unique_trusted_person_email_per_user IS
'Ensures each user cannot add the same email as a trusted person multiple times (case-insensitive, only for active records)';
