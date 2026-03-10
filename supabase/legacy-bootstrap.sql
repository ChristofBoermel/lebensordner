-- Generated file. Do not edit by hand.
-- Purpose: bootstrap legacy Supabase migrations on a fresh hosted project
-- Generated at: 2026-03-10 02:28:10 +01:00

-- ============================================================================
-- BEGIN supabase/migration_019_download_tokens.sql
-- ============================================================================
-- Download Tokens for One-Time Document Downloads
-- Allows users to share a time-limited download link without requiring recipient login

CREATE TABLE IF NOT EXISTS download_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  recipient_name VARCHAR(255),
  recipient_email VARCHAR(255)
);

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_download_tokens_token ON download_tokens(token);
CREATE INDEX IF NOT EXISTS idx_download_tokens_user ON download_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_download_tokens_expires ON download_tokens(expires_at);

-- RLS Policies
ALTER TABLE download_tokens ENABLE ROW LEVEL SECURITY;

-- Users can view their own tokens
CREATE POLICY "Users can view their own download tokens"
  ON download_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create tokens for themselves
CREATE POLICY "Users can create their own download tokens"
  ON download_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own tokens
CREATE POLICY "Users can update their own download tokens"
  ON download_tokens FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own tokens
CREATE POLICY "Users can delete their own download tokens"
  ON download_tokens FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE download_tokens IS 'Stores one-time download tokens for sharing documents without login';
COMMENT ON COLUMN download_tokens.token IS 'Unique token string for the download link';
COMMENT ON COLUMN download_tokens.expires_at IS 'Token expires after this time (default 12 hours)';
COMMENT ON COLUMN download_tokens.used_at IS 'Timestamp when the token was used for download';

-- ============================================================================
-- END supabase/migration_019_download_tokens.sql
-- ============================================================================

-- ============================================================================
-- BEGIN supabase/migration_030_download_link_types.sql
-- ============================================================================
-- Add link_type column to download_tokens table
ALTER TABLE download_tokens
ADD COLUMN link_type TEXT NOT NULL DEFAULT 'download'
CHECK (link_type IN ('view', 'download'));

-- Add index for better query performance
CREATE INDEX idx_download_tokens_link_type ON download_tokens(link_type);

-- ============================================================================
-- END supabase/migration_030_download_link_types.sql
-- ============================================================================

-- ============================================================================
-- BEGIN supabase/migration_033_email_tracking.sql
-- ============================================================================
-- Migration: Add email tracking fields to trusted_persons and create email retry queue
-- This migration adds support for email timeout handling and retry mechanisms

-- Add email tracking columns to trusted_persons table
ALTER TABLE trusted_persons
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_error TEXT,
ADD COLUMN IF NOT EXISTS email_retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS email_status TEXT CHECK (email_status IN ('pending', 'sending', 'sent', 'failed'));

-- Create email retry queue table
CREATE TABLE IF NOT EXISTS email_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trusted_person_id UUID NOT NULL REFERENCES trusted_persons(id) ON DELETE CASCADE,
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Create index for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_email_retry_queue_status_next_retry
ON email_retry_queue(status, next_retry_at)
WHERE status = 'pending';

-- Create index for finding queue items by trusted person
CREATE INDEX IF NOT EXISTS idx_email_retry_queue_trusted_person
ON email_retry_queue(trusted_person_id);

-- Add RLS policies for email_retry_queue (service role only)
ALTER TABLE email_retry_queue ENABLE ROW LEVEL SECURITY;

-- Only service role can access email_retry_queue
CREATE POLICY "Service role can manage email retry queue"
ON email_retry_queue
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Comment on new columns
COMMENT ON COLUMN trusted_persons.email_sent_at IS 'Timestamp when the invitation email was successfully sent';
COMMENT ON COLUMN trusted_persons.email_error IS 'Last error message from failed email send attempt';
COMMENT ON COLUMN trusted_persons.email_retry_count IS 'Number of email send retry attempts';
COMMENT ON COLUMN trusted_persons.email_status IS 'Current status of email delivery: pending, sending, sent, or failed';

COMMENT ON TABLE email_retry_queue IS 'Queue for retrying failed email sends with exponential backoff';
COMMENT ON COLUMN email_retry_queue.trusted_person_id IS 'Reference to the trusted person whose invitation email failed';
COMMENT ON COLUMN email_retry_queue.retry_count IS 'Number of retry attempts made';
COMMENT ON COLUMN email_retry_queue.last_error IS 'Error message from the last failed attempt';
COMMENT ON COLUMN email_retry_queue.next_retry_at IS 'Timestamp for when to attempt the next retry';
COMMENT ON COLUMN email_retry_queue.status IS 'Queue item status: pending, processing, completed, or failed';

-- ============================================================================
-- END supabase/migration_033_email_tracking.sql
-- ============================================================================

-- ============================================================================
-- BEGIN supabase/migration_035_security_foundation.sql
-- ============================================================================
-- Migration 035: Security Foundation - Phase 1
-- Purpose: Create security-related tables, modify existing tables for role-based access
--          and security tracking, add database trigger for role escalation prevention.
-- Date: 2026-02-06

-- ============================================================================
-- 1. NEW TABLE: rate_limits
-- Purpose: Track API request rates per identifier/endpoint for rate limiting
-- RLS: Service role only (no direct user access)
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE rate_limits IS 'Tracks API request rates per identifier and endpoint for rate limiting enforcement';

-- Composite index for fast lookups during rate limit checks
CREATE INDEX idx_rate_limits_lookup ON rate_limits(identifier, endpoint, window_start);

-- Cleanup index for purging old entries (>24 hours)
CREATE INDEX idx_rate_limits_cleanup ON rate_limits(window_start);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Service role only - no user access to rate limit data
CREATE POLICY "Service role can manage rate limits"
  ON rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 2. NEW TABLE: auth_lockouts
-- Purpose: Track authentication lockouts after failed login attempts
-- RLS: Service role only
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth_lockouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unlocked_at TIMESTAMPTZ,
  reason TEXT
);

COMMENT ON TABLE auth_lockouts IS 'Tracks authentication lockouts triggered by excessive failed login attempts';

-- Only one active lockout per email at a time
CREATE UNIQUE INDEX idx_auth_lockouts_active ON auth_lockouts(email) WHERE unlocked_at IS NULL;

ALTER TABLE auth_lockouts ENABLE ROW LEVEL SECURITY;

-- Service role only - no user access to lockout data
CREATE POLICY "Service role can manage auth lockouts"
  ON auth_lockouts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 3. NEW TABLE: consent_ledger
-- Purpose: GDPR-compliant consent tracking for analytics and marketing
-- RLS: Users can read/insert own records, service role has full access
-- ============================================================================

CREATE TABLE IF NOT EXISTS consent_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('analytics', 'marketing')),
  granted BOOLEAN NOT NULL,
  version TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE consent_ledger IS 'GDPR-compliant immutable ledger tracking user consent for analytics and marketing';

-- Index for user consent lookups
CREATE INDEX idx_consent_ledger_user ON consent_ledger(user_id, consent_type);

ALTER TABLE consent_ledger ENABLE ROW LEVEL SECURITY;

-- Users can view their own consent records
CREATE POLICY "Users can view own consent records"
  ON consent_ledger
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own consent records
CREATE POLICY "Users can insert own consent records"
  ON consent_ledger
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can read all consent records (for compliance reporting)
CREATE POLICY "Service role can read all consent records"
  ON consent_ledger
  FOR SELECT
  TO service_role
  USING (true);

-- ============================================================================
-- 4. NEW TABLE: security_audit_log
-- Purpose: Tamper-resistant audit log for security-relevant events
-- RLS: Users can read own records, service role can insert and read all
-- ============================================================================

CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE security_audit_log IS 'Tamper-resistant audit log for security-relevant events (login, role changes, data access)';

-- Index for querying user activity
CREATE INDEX idx_security_audit_log_user ON security_audit_log(user_id, timestamp DESC);

-- Index for filtering by event type
CREATE INDEX idx_security_audit_log_event ON security_audit_log(event_type, timestamp DESC);

ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own audit records
CREATE POLICY "Users can view own audit records"
  ON security_audit_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert audit records
CREATE POLICY "Service role can insert audit records"
  ON security_audit_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Service role can read all audit records
CREATE POLICY "Service role can read all audit records"
  ON security_audit_log
  FOR SELECT
  TO service_role
  USING (true);

-- Service role can update audit records (for maintenance/retention operations)
CREATE POLICY "Service role can update audit records"
  ON security_audit_log
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Service role can delete audit records (for log retention/purging)
CREATE POLICY "Service role can delete audit records"
  ON security_audit_log
  FOR DELETE
  TO service_role
  USING (true);

-- ============================================================================
-- 5. MODIFY TABLE: profiles
-- Purpose: Add role-based access control and encryption tracking flags
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin'));
COMMENT ON COLUMN profiles.role IS 'User role for access control. Only service_role can change this value.';

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_encrypted BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN profiles.phone_encrypted IS 'Flag indicating whether the phone field contains encrypted data';

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_encrypted BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN profiles.address_encrypted IS 'Flag indicating whether the address field contains encrypted data';

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth_encrypted BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN profiles.date_of_birth_encrypted IS 'Flag indicating whether the date_of_birth field contains encrypted data';

-- Partial index for quick admin lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role) WHERE role = 'admin';

-- ============================================================================
-- 6. DB TRIGGER: Prevent role self-escalation
-- Purpose: Only service_role can change user roles (prevents privilege escalation)
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_role_self_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check if the role is actually being changed
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- Verify the caller is service_role
    IF COALESCE(current_setting('request.jwt.claims', true)::json->>'role', '') != 'service_role' THEN
      RAISE EXCEPTION 'Only service role can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION prevent_role_self_escalation IS 'Trigger function that prevents users from escalating their own role. Only service_role can modify the role column.';

DROP TRIGGER IF EXISTS enforce_role_change_security ON profiles;
CREATE TRIGGER enforce_role_change_security
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_self_escalation();

-- ============================================================================
-- 7. MODIFY TABLE: download_tokens
-- Purpose: Add security tracking fields for token usage monitoring
-- ============================================================================

ALTER TABLE download_tokens ADD COLUMN IF NOT EXISTS created_ip TEXT;
COMMENT ON COLUMN download_tokens.created_ip IS 'IP address from which the download token was created';

ALTER TABLE download_tokens ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0;
COMMENT ON COLUMN download_tokens.access_count IS 'Number of times this token has been accessed';

ALTER TABLE download_tokens ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ;
COMMENT ON COLUMN download_tokens.last_accessed_at IS 'Timestamp of the most recent access using this token';

ALTER TABLE download_tokens ADD COLUMN IF NOT EXISTS last_accessed_ip TEXT;
COMMENT ON COLUMN download_tokens.last_accessed_ip IS 'IP address of the most recent access using this token';

-- Optimized index for token validation queries
CREATE INDEX IF NOT EXISTS idx_download_tokens_validation ON download_tokens(token, expires_at) WHERE used_at IS NULL;

-- ============================================================================
-- ROLLBACK SCRIPT (commented out - uncomment to reverse this migration)
-- Execute in reverse order to avoid FK constraint violations
-- ============================================================================

-- DROP INDEX IF EXISTS idx_download_tokens_validation;
-- ALTER TABLE download_tokens DROP COLUMN IF EXISTS last_accessed_ip;
-- ALTER TABLE download_tokens DROP COLUMN IF EXISTS last_accessed_at;
-- ALTER TABLE download_tokens DROP COLUMN IF EXISTS access_count;
-- ALTER TABLE download_tokens DROP COLUMN IF EXISTS created_ip;

-- DROP TRIGGER IF EXISTS enforce_role_change_security ON profiles;
-- DROP FUNCTION IF EXISTS prevent_role_self_escalation();

-- DROP INDEX IF EXISTS idx_profiles_role;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS date_of_birth_encrypted;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS address_encrypted;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS phone_encrypted;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS role;

-- DROP TABLE IF EXISTS security_audit_log;
-- DROP TABLE IF EXISTS consent_ledger;
-- DROP TABLE IF EXISTS auth_lockouts;
-- DROP TABLE IF EXISTS rate_limits;

-- ============================================================================
-- END supabase/migration_035_security_foundation.sql
-- ============================================================================

-- ============================================================================
-- BEGIN supabase/migration_037_performance_and_transactions.sql
-- ============================================================================
-- Migration 037: Performance & Transaction Fixes â€“ RPC Function & Storage Trigger
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

-- ============================================================================
-- END supabase/migration_037_performance_and_transactions.sql
-- ============================================================================

-- ============================================================================
-- BEGIN supabase/migration_038_rpc_security.sql
-- ============================================================================
-- Migration 038: RPC Security â€“ Restrict delete_user_account to service_role
-- Purpose: Close a privilege-escalation gap where any `authenticated` PostgREST
--          client could invoke delete_user_account() because SECURITY DEFINER
--          functions receive an implicit EXECUTE grant to PUBLIC on creation.
--
-- Security rationale:
--   â€¢ delete_user_account() is SECURITY DEFINER and therefore runs with the
--     privileges of its defining role (postgres/service). Without explicit
--     EXECUTE restrictions, any authenticated PostgREST client could call it
--     via RPC and wipe arbitrary user data.
--   â€¢ This migration closes the gap with three complementary, independent
--     controls:
--       1. REVOKE EXECUTE from PUBLIC and `authenticated` (permission layer).
--       2. GRANT EXECUTE to service_role only (allow-list layer).
--       3. JWT role guard inside the function body (defence-in-depth layer).
--   â€¢ A hardened SET search_path = public is also added to the function
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

-- ============================================================================
-- END supabase/migration_038_rpc_security.sql
-- ============================================================================

-- ============================================================================
-- BEGIN supabase/migration_039_doc_count_rpc.sql
-- ============================================================================
-- Migration 039: Document Count RPC Function
-- Purpose: Create get_document_counts RPC function (SECURITY DEFINER) to replace
--          in-memory document counting in the family/members route with a single
--          aggregated DB query, reducing N+1 risk for large member lists.
-- Date: 2026-02-18
-- Security rationale: SECURITY DEFINER allows the function to read documents on
--          behalf of the caller without exposing the service role. REVOKE from PUBLIC
--          and GRANT to service_role ensures only server-side code (adminClient) can
--          invoke it, preventing unauthenticated clients from enumerating counts.

-- ============================================================================
-- 1. FUNCTION: get_document_counts(p_user_ids uuid[])
-- Purpose: Return one row per user_id with the total number of documents owned
--          by that user. Users with zero documents are omitted from the result;
--          callers should use a ?? 0 fallback when looking up absent entries.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_document_counts(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, doc_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT d.user_id, COUNT(*)::bigint
    FROM documents d
    WHERE d.user_id = ANY(p_user_ids)
    GROUP BY d.user_id;
END;
$$;

COMMENT ON FUNCTION get_document_counts(uuid[]) IS 'Returns one row per user_id with the document count for each user in the supplied array. Users with no documents are omitted; callers should default absent entries to 0.';

-- ============================================================================
-- Permission hardening
-- SECURITY DEFINER functions inherit owner privileges, so we restrict EXECUTE
-- to service_role only (used by the server-side adminClient). Prevents direct
-- invocation by authenticated or anonymous Supabase client roles.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION get_document_counts(uuid[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_document_counts(uuid[]) TO service_role;

-- ============================================================================
-- ROLLBACK SCRIPT (commented out - uncomment to reverse this migration)
-- ============================================================================

-- DROP FUNCTION IF EXISTS get_document_counts(uuid[]);

-- ============================================================================
-- END supabase/migration_039_doc_count_rpc.sql
-- ============================================================================
