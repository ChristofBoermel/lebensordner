-- Migration 037: Performance & Transaction Fixes – RPC Function & Storage Trigger
-- Purpose: Create delete_user_account RPC function (SECURITY DEFINER) for atomic
--          account deletion, and a trigger to keep profiles.storage_used in sync
--          with documents inserts/deletes.
-- Date: 2026-02-18

-- ============================================================================
-- 1. FUNCTION: delete_user_account(p_user_id UUID, p_email TEXT)
-- Purpose: Atomically delete all user data rows that do NOT have an existing
--          ON DELETE CASCADE referencing profiles(id). Deletes profiles last
--          so that existing cascades on advance_directives, funeral_wishes,
--          custom_categories, and subcategories fire automatically.
--          consent_ledger and download_tokens cascade from auth.users(id).
--          email_retry_queue cascades from trusted_persons(id).
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_user_account(p_user_id UUID, p_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Explicit delete: documents have no ON DELETE CASCADE from profiles
  DELETE FROM documents WHERE user_id = p_user_id;

  -- Explicit delete: reminders have no ON DELETE CASCADE from profiles
  DELETE FROM reminders WHERE user_id = p_user_id;

  -- Explicit delete: trusted_persons has no CASCADE from profiles;
  -- this cascades email_retry_queue via trusted_persons(id) FK
  DELETE FROM trusted_persons WHERE user_id = p_user_id;

  -- Explicit delete: medical_info has no ON DELETE CASCADE from profiles
  DELETE FROM medical_info WHERE user_id = p_user_id;

  -- Explicit delete: emergency_contacts has no ON DELETE CASCADE from profiles
  DELETE FROM emergency_contacts WHERE user_id = p_user_id;

  -- Explicit delete: rate_limits has no user_id column; match by email pattern
  DELETE FROM rate_limits WHERE identifier LIKE '%' || p_email || '%';

  -- Explicit delete: auth_lockouts has no user_id column; match by email
  DELETE FROM auth_lockouts WHERE email = p_email;

  -- Hard delete onboarding_feedback for GDPR compliance.
  -- The table's FK references auth.users(id) ON DELETE SET NULL, which would
  -- only nullify user_id (leaving free-text comments). We explicitly delete
  -- all rows here to ensure no PII survives account deletion.
  DELETE FROM onboarding_feedback WHERE user_id = p_user_id;

  -- Delete profiles last: triggers ON DELETE CASCADE on advance_directives,
  -- funeral_wishes, custom_categories, and subcategories
  DELETE FROM profiles WHERE id = p_user_id;
END;
$$;

COMMENT ON FUNCTION delete_user_account(UUID, TEXT) IS 'Atomically deletes all user data: explicit deletes for documents, reminders, trusted_persons, medical_info, emergency_contacts, rate_limits, auth_lockouts, and onboarding_feedback, then profiles last to trigger cascading deletes on dependent tables.';

-- ============================================================================
-- 2. TRIGGER FUNCTION: update_storage_used_on_document_change()
-- Purpose: Keep profiles.storage_used accurate by incrementing on document
--          INSERT and decrementing (floor 0) on document DELETE. Runs in the
--          same transaction as the DML, making the counter update atomic.
-- ============================================================================

CREATE OR REPLACE FUNCTION update_storage_used_on_document_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET storage_used = COALESCE(storage_used, 0) + NEW.file_size WHERE id = NEW.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET storage_used = GREATEST(0, COALESCE(storage_used, 0) - OLD.file_size) WHERE id = OLD.user_id;
    RETURN OLD;
  END IF;
END;
$$;

COMMENT ON FUNCTION update_storage_used_on_document_change() IS 'Trigger function that keeps profiles.storage_used in sync by incrementing on INSERT and decrementing (floor 0) on DELETE of documents rows.';

-- ============================================================================
-- 3. TRIGGER: trg_storage_used on documents
-- Purpose: Fire update_storage_used_on_document_change after each row-level
--          INSERT or DELETE on the documents table.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_storage_used ON documents;
CREATE TRIGGER trg_storage_used
  AFTER INSERT OR DELETE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_storage_used_on_document_change();

-- ============================================================================
-- ROLLBACK SCRIPT (commented out - uncomment to reverse this migration)
-- Execute in reverse order to avoid dependency violations
-- ============================================================================

-- DROP TRIGGER IF EXISTS trg_storage_used ON documents;
-- DROP FUNCTION IF EXISTS update_storage_used_on_document_change();
-- DROP FUNCTION IF EXISTS delete_user_account(UUID, TEXT);
