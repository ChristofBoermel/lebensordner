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
