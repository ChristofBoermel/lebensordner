-- Add last_active_at for inactivity tracking
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

-- Emergency Access Protocol settings
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS emergency_access_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS emergency_access_days integer NOT NULL DEFAULT 60
    CHECK (emergency_access_days IN (30, 60, 90)),
  ADD COLUMN IF NOT EXISTS emergency_access_trusted_person_id uuid
    REFERENCES trusted_persons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS emergency_access_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS emergency_access_test_sent_at timestamptz;

-- Index for cron query (find users overdue for notification)
CREATE INDEX IF NOT EXISTS idx_profiles_emergency_access
  ON profiles (emergency_access_enabled, last_active_at)
  WHERE emergency_access_enabled = true;

-- Index for activity update (used in middleware debounce)
CREATE INDEX IF NOT EXISTS idx_profiles_last_active_at
  ON profiles (id, last_active_at);
