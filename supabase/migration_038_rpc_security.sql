-- Migration 038: RPC Security – Restrict delete_user_account to service_role
-- Purpose: Close a privilege-escalation gap where any `authenticated` PostgREST
--          client could invoke delete_user_account() because SECURITY DEFINER
--          functions receive an implicit EXECUTE grant to PUBLIC on creation.
--
-- Security rationale:
--   • delete_user_account() is SECURITY DEFINER and therefore runs with the
--     privileges of its defining role (postgres/service). Without explicit
--     EXECUTE restrictions, any authenticated PostgREST client could call it
--     via RPC and wipe arbitrary user data.
--   • This migration closes the gap with three complementary, independent
--     controls:
--       1. REVOKE EXECUTE from PUBLIC and `authenticated` (permission layer).
--       2. GRANT EXECUTE to service_role only (allow-list layer).
--       3. JWT role guard inside the function body (defence-in-depth layer).
--   • A hardened SET search_path = public is also added to the function
--     signature to prevent search-path injection attacks on SECURITY DEFINER
--     functions.
-- Date: 2026-02-18

-- ============================================================================
-- 1. REVOKE EXECUTE from PUBLIC and authenticated
-- ============================================================================

-- Revoke the implicit PUBLIC grant added by PostgreSQL when the function was
-- first created. The explicit `authenticated` revoke is belt-and-suspenders
-- for Supabase's role hierarchy, where `authenticated` inherits from PUBLIC.
REVOKE EXECUTE ON FUNCTION delete_user_account(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION delete_user_account(UUID, TEXT) FROM authenticated;

-- ============================================================================
-- 2. GRANT EXECUTE to service_role only
-- ============================================================================

GRANT EXECUTE ON FUNCTION delete_user_account(UUID, TEXT) TO service_role;

-- ============================================================================
-- 3. Re-create function with search_path hardening and JWT role guard
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_user_account(p_user_id UUID, p_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- JWT role guard: reject any caller that is not service_role.
  -- Fires before any DELETE, so a non-service-role caller is rejected
  -- deterministically even if the GRANT/REVOKE layer were somehow bypassed.
  -- Pattern mirrors prevent_role_self_escalation() from migration_035.
  IF COALESCE(current_setting('request.jwt.claims', true)::json->>'role', '') != 'service_role' THEN
    RAISE EXCEPTION 'Permission denied: delete_user_account requires service_role';
  END IF;

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

-- ============================================================================
-- 4. Update COMMENT to reflect security restrictions
-- ============================================================================

COMMENT ON FUNCTION delete_user_account(UUID, TEXT) IS
  'Atomically deletes all user data: explicit deletes for tables without CASCADE, '
  'then profiles last to trigger cascading deletes on dependent tables. '
  'Restricted to service_role via EXECUTE grant and an internal JWT role guard; '
  'any non-service-role caller is rejected before any DELETE executes.';

-- ============================================================================
-- ROLLBACK SCRIPT (commented out - uncomment to reverse this migration)
-- Execute in the order shown to avoid leaving the function in a broken state.
-- ============================================================================

-- REVOKE EXECUTE ON FUNCTION delete_user_account(UUID, TEXT) FROM service_role;
-- GRANT EXECUTE ON FUNCTION delete_user_account(UUID, TEXT) TO PUBLIC;
-- Re-create function without SET search_path and without role guard,
-- matching the migration_037 body exactly:
--
-- CREATE OR REPLACE FUNCTION delete_user_account(p_user_id UUID, p_email TEXT)
-- RETURNS void
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- AS $$
-- BEGIN
--   DELETE FROM documents WHERE user_id = p_user_id;
--   DELETE FROM reminders WHERE user_id = p_user_id;
--   DELETE FROM trusted_persons WHERE user_id = p_user_id;
--   DELETE FROM medical_info WHERE user_id = p_user_id;
--   DELETE FROM emergency_contacts WHERE user_id = p_user_id;
--   DELETE FROM rate_limits WHERE identifier LIKE '%' || p_email || '%';
--   DELETE FROM auth_lockouts WHERE email = p_email;
--   DELETE FROM onboarding_feedback WHERE user_id = p_user_id;
--   DELETE FROM profiles WHERE id = p_user_id;
-- END;
-- $$;
--
-- COMMENT ON FUNCTION delete_user_account(UUID, TEXT) IS
--   'Atomically deletes all user data: explicit deletes for tables without CASCADE, '
--   'then profiles last to trigger cascading deletes on dependent tables.';
