ALTER TABLE medical_info
  ADD COLUMN IF NOT EXISTS medication_plan_updated_at timestamptz;
