-- Emergency Access Requests Table
-- Allows trusted persons to request emergency access to documents

CREATE TABLE IF NOT EXISTS emergency_access_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trusted_person_id UUID NOT NULL REFERENCES trusted_persons(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired', 'cancelled')),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  denied_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  denial_reason TEXT
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_emergency_access_requests_requester ON emergency_access_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_emergency_access_requests_owner ON emergency_access_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_emergency_access_requests_status ON emergency_access_requests(status);
CREATE INDEX IF NOT EXISTS idx_emergency_access_requests_trusted_person ON emergency_access_requests(trusted_person_id);

-- RLS Policies
ALTER TABLE emergency_access_requests ENABLE ROW LEVEL SECURITY;

-- Requesters can view their own requests
CREATE POLICY "Users can view their own requests"
  ON emergency_access_requests FOR SELECT
  USING (auth.uid() = requester_id);

-- Owners can view requests for their documents
CREATE POLICY "Owners can view requests for their documents"
  ON emergency_access_requests FOR SELECT
  USING (auth.uid() = owner_id);

-- Authenticated users can create requests (will verify trusted_person link in API)
CREATE POLICY "Authenticated users can create requests"
  ON emergency_access_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

-- Owners can update request status
CREATE POLICY "Owners can update request status"
  ON emergency_access_requests FOR UPDATE
  USING (auth.uid() = owner_id);

-- Requesters can cancel their own pending requests
CREATE POLICY "Requesters can cancel their own requests"
  ON emergency_access_requests FOR UPDATE
  USING (auth.uid() = requester_id AND status = 'pending');

-- Grant function to update updated_at
CREATE OR REPLACE FUNCTION update_emergency_access_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_emergency_access_requests_updated_at
  BEFORE UPDATE ON emergency_access_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_emergency_access_updated_at();

-- Add notifications column to profiles for emergency access alerts (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'emergency_access_notifications'
  ) THEN
    ALTER TABLE profiles ADD COLUMN emergency_access_notifications BOOLEAN DEFAULT true;
  END IF;
END $$;

COMMENT ON TABLE emergency_access_requests IS 'Stores emergency access requests from trusted persons';
