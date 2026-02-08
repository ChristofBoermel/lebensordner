-- Migration 036: Add encryption tracking columns and fix column types
-- Purpose: Create *_encrypted boolean flags for all encrypted fields across
--          notfall tables, change array columns to text for encrypted JSON blobs,
--          and add two_factor_secret_encrypted flag on profiles.
-- Date: 2026-02-07

-- ============================================================================
-- 1. medical_info: Add encryption flags and change array columns to text
-- ============================================================================

-- Change conditions, medications, allergies from text[] to text
-- to store encrypted JSON blob {iv, authTag, ciphertext}
ALTER TABLE medical_info
  ALTER COLUMN conditions TYPE text USING CASE
    WHEN conditions IS NULL THEN NULL
    ELSE array_to_json(conditions)::text
  END,
  ALTER COLUMN medications TYPE text USING CASE
    WHEN medications IS NULL THEN NULL
    ELSE array_to_json(medications)::text
  END,
  ALTER COLUMN allergies TYPE text USING CASE
    WHEN allergies IS NULL THEN NULL
    ELSE array_to_json(allergies)::text
  END;

-- Add encryption tracking flags
ALTER TABLE medical_info ADD COLUMN IF NOT EXISTS conditions_encrypted BOOLEAN DEFAULT FALSE;
ALTER TABLE medical_info ADD COLUMN IF NOT EXISTS medications_encrypted BOOLEAN DEFAULT FALSE;
ALTER TABLE medical_info ADD COLUMN IF NOT EXISTS allergies_encrypted BOOLEAN DEFAULT FALSE;
ALTER TABLE medical_info ADD COLUMN IF NOT EXISTS blood_type_encrypted BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN medical_info.conditions_encrypted IS 'Flag indicating whether conditions contains an encrypted JSON blob';
COMMENT ON COLUMN medical_info.medications_encrypted IS 'Flag indicating whether medications contains an encrypted JSON blob';
COMMENT ON COLUMN medical_info.allergies_encrypted IS 'Flag indicating whether allergies contains an encrypted JSON blob';
COMMENT ON COLUMN medical_info.blood_type_encrypted IS 'Flag indicating whether blood_type contains an encrypted JSON blob';

-- ============================================================================
-- 2. emergency_contacts: Add encryption flags
-- ============================================================================

ALTER TABLE emergency_contacts ADD COLUMN IF NOT EXISTS phone_encrypted BOOLEAN DEFAULT FALSE;
ALTER TABLE emergency_contacts ADD COLUMN IF NOT EXISTS relationship_encrypted BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN emergency_contacts.phone_encrypted IS 'Flag indicating whether phone contains an encrypted JSON blob';
COMMENT ON COLUMN emergency_contacts.relationship_encrypted IS 'Flag indicating whether relationship contains an encrypted JSON blob';

-- ============================================================================
-- 3. advance_directives: Add encryption flags
-- ============================================================================

ALTER TABLE advance_directives ADD COLUMN IF NOT EXISTS patient_decree_location_encrypted BOOLEAN DEFAULT FALSE;
ALTER TABLE advance_directives ADD COLUMN IF NOT EXISTS power_of_attorney_holder_encrypted BOOLEAN DEFAULT FALSE;
ALTER TABLE advance_directives ADD COLUMN IF NOT EXISTS care_directive_location_encrypted BOOLEAN DEFAULT FALSE;
ALTER TABLE advance_directives ADD COLUMN IF NOT EXISTS bank_power_of_attorney_holder_encrypted BOOLEAN DEFAULT FALSE;
ALTER TABLE advance_directives ADD COLUMN IF NOT EXISTS notes_encrypted BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN advance_directives.patient_decree_location_encrypted IS 'Flag indicating whether patient_decree_location contains an encrypted JSON blob';
COMMENT ON COLUMN advance_directives.power_of_attorney_holder_encrypted IS 'Flag indicating whether power_of_attorney_holder contains an encrypted JSON blob';
COMMENT ON COLUMN advance_directives.care_directive_location_encrypted IS 'Flag indicating whether care_directive_location contains an encrypted JSON blob';
COMMENT ON COLUMN advance_directives.bank_power_of_attorney_holder_encrypted IS 'Flag indicating whether bank_power_of_attorney_holder contains an encrypted JSON blob';
COMMENT ON COLUMN advance_directives.notes_encrypted IS 'Flag indicating whether notes contains an encrypted JSON blob';

-- ============================================================================
-- 4. funeral_wishes: Add encryption flags
-- ============================================================================

ALTER TABLE funeral_wishes ADD COLUMN IF NOT EXISTS burial_location_encrypted BOOLEAN DEFAULT FALSE;
ALTER TABLE funeral_wishes ADD COLUMN IF NOT EXISTS ceremony_wishes_encrypted BOOLEAN DEFAULT FALSE;
ALTER TABLE funeral_wishes ADD COLUMN IF NOT EXISTS music_wishes_encrypted BOOLEAN DEFAULT FALSE;
ALTER TABLE funeral_wishes ADD COLUMN IF NOT EXISTS flowers_wishes_encrypted BOOLEAN DEFAULT FALSE;
ALTER TABLE funeral_wishes ADD COLUMN IF NOT EXISTS additional_wishes_encrypted BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN funeral_wishes.burial_location_encrypted IS 'Flag indicating whether burial_location contains an encrypted JSON blob';
COMMENT ON COLUMN funeral_wishes.ceremony_wishes_encrypted IS 'Flag indicating whether ceremony_wishes contains an encrypted JSON blob';
COMMENT ON COLUMN funeral_wishes.music_wishes_encrypted IS 'Flag indicating whether music_wishes contains an encrypted JSON blob';
COMMENT ON COLUMN funeral_wishes.flowers_wishes_encrypted IS 'Flag indicating whether flowers_wishes contains an encrypted JSON blob';
COMMENT ON COLUMN funeral_wishes.additional_wishes_encrypted IS 'Flag indicating whether additional_wishes contains an encrypted JSON blob';

-- ============================================================================
-- 5. profiles: Add two_factor_secret_encrypted flag
-- Ensure two_factor_secret is text (it already should be) for encrypted JSON
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS two_factor_secret_encrypted BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN profiles.two_factor_secret_encrypted IS 'Flag indicating whether two_factor_secret contains an encrypted JSON blob';

-- ============================================================================
-- ROLLBACK SCRIPT (commented out - uncomment to reverse this migration)
-- ============================================================================

-- ALTER TABLE profiles DROP COLUMN IF EXISTS two_factor_secret_encrypted;
--
-- ALTER TABLE funeral_wishes DROP COLUMN IF EXISTS additional_wishes_encrypted;
-- ALTER TABLE funeral_wishes DROP COLUMN IF EXISTS flowers_wishes_encrypted;
-- ALTER TABLE funeral_wishes DROP COLUMN IF EXISTS music_wishes_encrypted;
-- ALTER TABLE funeral_wishes DROP COLUMN IF EXISTS ceremony_wishes_encrypted;
-- ALTER TABLE funeral_wishes DROP COLUMN IF EXISTS burial_location_encrypted;
--
-- ALTER TABLE advance_directives DROP COLUMN IF EXISTS notes_encrypted;
-- ALTER TABLE advance_directives DROP COLUMN IF EXISTS bank_power_of_attorney_holder_encrypted;
-- ALTER TABLE advance_directives DROP COLUMN IF EXISTS care_directive_location_encrypted;
-- ALTER TABLE advance_directives DROP COLUMN IF EXISTS power_of_attorney_holder_encrypted;
-- ALTER TABLE advance_directives DROP COLUMN IF EXISTS patient_decree_location_encrypted;
--
-- ALTER TABLE emergency_contacts DROP COLUMN IF EXISTS relationship_encrypted;
-- ALTER TABLE emergency_contacts DROP COLUMN IF EXISTS phone_encrypted;
--
-- ALTER TABLE medical_info DROP COLUMN IF EXISTS blood_type_encrypted;
-- ALTER TABLE medical_info DROP COLUMN IF EXISTS allergies_encrypted;
-- ALTER TABLE medical_info DROP COLUMN IF EXISTS medications_encrypted;
-- ALTER TABLE medical_info DROP COLUMN IF EXISTS conditions_encrypted;
--
-- ALTER TABLE medical_info
--   ALTER COLUMN conditions TYPE text[] USING CASE
--     WHEN conditions IS NULL THEN NULL
--     ELSE ARRAY(SELECT json_array_elements_text(conditions::json))
--   END,
--   ALTER COLUMN medications TYPE text[] USING CASE
--     WHEN medications IS NULL THEN NULL
--     ELSE ARRAY(SELECT json_array_elements_text(medications::json))
--   END,
--   ALTER COLUMN allergies TYPE text[] USING CASE
--     WHEN allergies IS NULL THEN NULL
--     ELSE ARRAY(SELECT json_array_elements_text(allergies::json))
--   END;
