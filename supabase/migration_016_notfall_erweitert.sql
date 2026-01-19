-- Migration 016: Notfall & Vorsorge erweitert
-- Organspende, Vollmachten, Bestattungswünsche

-- Erweitere medical_info Tabelle um Organspende und weitere Felder
ALTER TABLE public.medical_info
ADD COLUMN IF NOT EXISTS organ_donor BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS organ_donor_card_location TEXT,
ADD COLUMN IF NOT EXISTS organ_donor_notes TEXT;

-- Vorsorgedokumente Tabelle
CREATE TABLE IF NOT EXISTS public.advance_directives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Patientenverfügung
  has_patient_decree BOOLEAN DEFAULT FALSE,
  patient_decree_location TEXT,
  patient_decree_date DATE,

  -- Vorsorgevollmacht
  has_power_of_attorney BOOLEAN DEFAULT FALSE,
  power_of_attorney_location TEXT,
  power_of_attorney_holder TEXT,
  power_of_attorney_date DATE,

  -- Betreuungsverfügung
  has_care_directive BOOLEAN DEFAULT FALSE,
  care_directive_location TEXT,
  care_directive_date DATE,

  -- Bankenvollmacht
  has_bank_power_of_attorney BOOLEAN DEFAULT FALSE,
  bank_power_of_attorney_holder TEXT,
  bank_power_of_attorney_banks TEXT,

  notes TEXT,

  UNIQUE(user_id)
);

-- Bestattungswünsche Tabelle
CREATE TABLE IF NOT EXISTS public.funeral_wishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Bestattungsart
  burial_type TEXT, -- 'erdbestattung', 'feuerbestattung', 'seebestattung', 'naturbestattung', 'keine_praeferenz'
  burial_location TEXT,

  -- Trauerfeier
  ceremony_type TEXT, -- 'kirchlich', 'weltlich', 'keine', 'keine_praeferenz'
  ceremony_wishes TEXT,

  -- Musik/Blumen/etc
  music_wishes TEXT,
  flowers_wishes TEXT,

  -- Sonstiges
  additional_wishes TEXT,

  -- Bestattungsvorsorge
  has_funeral_insurance BOOLEAN DEFAULT FALSE,
  funeral_insurance_provider TEXT,
  funeral_insurance_number TEXT,

  UNIQUE(user_id)
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_advance_directives_user_id ON public.advance_directives(user_id);
CREATE INDEX IF NOT EXISTS idx_funeral_wishes_user_id ON public.funeral_wishes(user_id);

-- RLS für advance_directives
ALTER TABLE public.advance_directives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own advance directives" ON public.advance_directives
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own advance directives" ON public.advance_directives
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own advance directives" ON public.advance_directives
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own advance directives" ON public.advance_directives
  FOR DELETE USING (auth.uid() = user_id);

-- RLS für funeral_wishes
ALTER TABLE public.funeral_wishes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own funeral wishes" ON public.funeral_wishes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own funeral wishes" ON public.funeral_wishes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own funeral wishes" ON public.funeral_wishes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own funeral wishes" ON public.funeral_wishes
  FOR DELETE USING (auth.uid() = user_id);

-- Kommentare
COMMENT ON TABLE public.advance_directives IS 'Vorsorgedokumente: Patientenverfügung, Vollmachten, etc.';
COMMENT ON TABLE public.funeral_wishes IS 'Bestattungswünsche des Benutzers';
