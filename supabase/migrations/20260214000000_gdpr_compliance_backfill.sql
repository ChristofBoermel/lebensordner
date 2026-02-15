-- Migration: GDPR Compliance Backfill
-- Date: 2026-02-14
-- Purpose: Backfill manually-applied GDPR schema changes for reproducibility
-- Note: These changes are already applied in production; this ensures fresh environments match.

-- ============================================================================
-- 1. Extend consent_ledger to support health_data and privacy_policy
-- ============================================================================
-- Update constraint to include additional consent types used by the application.

ALTER TABLE consent_ledger
  DROP CONSTRAINT IF EXISTS consent_ledger_consent_type_check;

ALTER TABLE consent_ledger
  ADD CONSTRAINT consent_ledger_consent_type_check
  CHECK (consent_type IN ('analytics', 'marketing', 'health_data', 'privacy_policy'));

-- ============================================================================
-- 2. Add health consent tracking columns to profiles
-- ============================================================================
-- Track current health data consent status and when it was granted.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS health_data_consent_granted BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN profiles.health_data_consent_granted IS 'Indicates whether the user has granted consent for health data processing.';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS health_data_consent_timestamp TIMESTAMPTZ DEFAULT NULL;
COMMENT ON COLUMN profiles.health_data_consent_timestamp IS 'Timestamp when health data consent was granted; NULL when not granted.';

-- ============================================================================
-- 3. Create trigger function for health consent withdrawal
-- ============================================================================
-- Deletes all health-related data and logs the action when consent is withdrawn.

CREATE OR REPLACE FUNCTION on_health_consent_withdrawal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.consent_type = 'health_data' AND NEW.granted = false THEN
    DELETE FROM medical_info WHERE user_id = NEW.user_id;
    DELETE FROM emergency_contacts WHERE user_id = NEW.user_id;
    DELETE FROM advance_directives WHERE user_id = NEW.user_id;
    DELETE FROM funeral_wishes WHERE user_id = NEW.user_id;

    UPDATE profiles
      SET health_data_consent_granted = false,
          health_data_consent_timestamp = NULL
      WHERE id = NEW.user_id;

    INSERT INTO security_audit_log (user_id, event_type, event_data, timestamp)
      VALUES (
        NEW.user_id,
        'health_consent_withdrawn',
        jsonb_build_object('consent_version', NEW.version),
        NOW()
      );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION on_health_consent_withdrawal IS 'Fires on health data consent withdrawal to delete health-related data and create an audit log entry.';

-- ============================================================================
-- 4. Create trigger on consent_ledger
-- ============================================================================
-- Executes the withdrawal cleanup after a consent ledger entry is inserted.

DROP TRIGGER IF EXISTS on_health_consent_withdrawal ON consent_ledger;
CREATE TRIGGER on_health_consent_withdrawal
  AFTER INSERT ON consent_ledger
  FOR EACH ROW
  EXECUTE FUNCTION on_health_consent_withdrawal();

COMMENT ON TRIGGER on_health_consent_withdrawal ON consent_ledger IS 'Deletes health-related data and logs audit record when health consent is withdrawn.';

-- ============================================================================
-- ROLLBACK SCRIPT (commented out - uncomment to reverse this migration)
-- Execute in reverse order to avoid dependency issues
-- ============================================================================

-- DROP TRIGGER IF EXISTS on_health_consent_withdrawal ON consent_ledger;
-- DROP FUNCTION IF EXISTS on_health_consent_withdrawal();

-- ALTER TABLE profiles DROP COLUMN IF EXISTS health_data_consent_timestamp;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS health_data_consent_granted;

-- ALTER TABLE consent_ledger DROP CONSTRAINT IF EXISTS consent_ledger_consent_type_check;
-- ALTER TABLE consent_ledger ADD CONSTRAINT consent_ledger_consent_type_check
--   CHECK (consent_type IN ('analytics', 'marketing'));
