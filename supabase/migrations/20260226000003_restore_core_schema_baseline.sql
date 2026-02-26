-- Restore core schema baseline after partial/missing early migrations.
-- Safe to run on production: creates missing objects and adds missing columns.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'document_category') THEN
    CREATE TYPE public.document_category AS ENUM (
      'identitaet',
      'finanzen',
      'versicherungen',
      'wohnen',
      'gesundheit',
      'vertraege',
      'rente'
    );
  END IF;
END
$$;

ALTER TYPE public.document_category ADD VALUE IF NOT EXISTS 'familie';
ALTER TYPE public.document_category ADD VALUE IF NOT EXISTS 'arbeit';
ALTER TYPE public.document_category ADD VALUE IF NOT EXISTS 'religion';
ALTER TYPE public.document_category ADD VALUE IF NOT EXISTS 'bevollmaechtigungen';
ALTER TYPE public.document_category ADD VALUE IF NOT EXISTS 'testament';
ALTER TYPE public.document_category ADD VALUE IF NOT EXISTS 'sonstige';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'access_level') THEN
    CREATE TYPE public.access_level AS ENUM ('immediate', 'emergency', 'after_confirmation');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'reminder_type') THEN
    CREATE TYPE public.reminder_type AS ENUM ('document_expiry', 'annual_review', 'custom');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  email text NOT NULL,
  full_name text,
  phone text,
  date_of_birth date,
  address text,
  onboarding_completed boolean DEFAULT false,
  storage_used bigint DEFAULT 0
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_progress text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_reminders_enabled boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_reminder_days_before integer DEFAULT 7;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_price_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS two_factor_secret text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sms_reminders_enabled boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sms_reminder_days_before integer DEFAULT 3;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_picture_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS upgrade_email_7d_sent_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS upgrade_email_30d_sent_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_encrypted boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_encrypted boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth_encrypted boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS two_factor_secret_encrypted boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS health_data_consent_granted boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS health_data_consent_timestamp timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS middle_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS academic_title text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_access_notifications boolean DEFAULT true;

CREATE TABLE IF NOT EXISTS public.custom_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  icon text DEFAULT 'folder',
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS public.subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_category text NOT NULL,
  name text NOT NULL,
  icon text DEFAULT 'folder',
  UNIQUE (user_id, parent_category, name)
);

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category text NOT NULL,
  title text NOT NULL,
  notes text,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  expiry_date date,
  reminder_date date
);

ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS subcategory_id uuid REFERENCES public.subcategories(id) ON DELETE SET NULL;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS custom_category_id uuid REFERENCES public.custom_categories(id) ON DELETE SET NULL;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS custom_reminder_days integer;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS reminder_watcher_id uuid;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS reminder_watcher_notified_at timestamptz;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS sms_reminder_sent boolean DEFAULT false;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS is_encrypted boolean NOT NULL DEFAULT false;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS encryption_version text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS wrapped_dek text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_iv text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS title_encrypted text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS notes_encrypted text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_name_encrypted text;

CREATE TABLE IF NOT EXISTS public.trusted_persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  relationship text NOT NULL,
  access_level public.access_level DEFAULT 'emergency',
  access_delay_hours integer DEFAULT 48,
  notes text,
  is_active boolean DEFAULT true
);

ALTER TABLE public.trusted_persons ADD COLUMN IF NOT EXISTS invitation_token text;
ALTER TABLE public.trusted_persons ADD COLUMN IF NOT EXISTS invitation_status text;
ALTER TABLE public.trusted_persons ADD COLUMN IF NOT EXISTS invitation_sent_at timestamptz;
ALTER TABLE public.trusted_persons ADD COLUMN IF NOT EXISTS invitation_accepted_at timestamptz;
ALTER TABLE public.trusted_persons ADD COLUMN IF NOT EXISTS linked_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.trusted_persons ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
ALTER TABLE public.trusted_persons ADD COLUMN IF NOT EXISTS email_error text;
ALTER TABLE public.trusted_persons ADD COLUMN IF NOT EXISTS email_retry_count integer DEFAULT 0;
ALTER TABLE public.trusted_persons ADD COLUMN IF NOT EXISTS email_status text;

CREATE TABLE IF NOT EXISTS public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date date NOT NULL,
  is_completed boolean DEFAULT false,
  reminder_type public.reminder_type DEFAULT 'custom'
);

ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS sms_sent boolean DEFAULT false;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS reminder_watcher_id uuid REFERENCES public.trusted_persons(id) ON DELETE SET NULL;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS reminder_watcher_notified_at timestamptz;

CREATE TABLE IF NOT EXISTS public.medical_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  conditions text,
  medications text,
  allergies text,
  doctor_name text,
  doctor_phone text,
  insurance_number text,
  additional_notes text
);

ALTER TABLE public.medical_info ADD COLUMN IF NOT EXISTS organ_donor boolean;
ALTER TABLE public.medical_info ADD COLUMN IF NOT EXISTS organ_donor_card_location text;
ALTER TABLE public.medical_info ADD COLUMN IF NOT EXISTS organ_donor_notes text;
ALTER TABLE public.medical_info ADD COLUMN IF NOT EXISTS conditions_encrypted boolean DEFAULT false;
ALTER TABLE public.medical_info ADD COLUMN IF NOT EXISTS medications_encrypted boolean DEFAULT false;
ALTER TABLE public.medical_info ADD COLUMN IF NOT EXISTS allergies_encrypted boolean DEFAULT false;
ALTER TABLE public.medical_info ADD COLUMN IF NOT EXISTS medication_plan_updated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  relationship text NOT NULL,
  is_primary boolean DEFAULT false,
  notes text
);

ALTER TABLE public.emergency_contacts ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.emergency_contacts ADD COLUMN IF NOT EXISTS phone_encrypted boolean DEFAULT false;
ALTER TABLE public.emergency_contacts ADD COLUMN IF NOT EXISTS relationship_encrypted boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS public.advance_directives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  has_patient_decree boolean DEFAULT false,
  patient_decree_location text,
  patient_decree_date date,
  has_power_of_attorney boolean DEFAULT false,
  power_of_attorney_location text,
  power_of_attorney_holder text,
  power_of_attorney_date date,
  has_care_directive boolean DEFAULT false,
  care_directive_location text,
  care_directive_date date,
  has_bank_power_of_attorney boolean DEFAULT false,
  bank_power_of_attorney_holder text,
  bank_power_of_attorney_banks text,
  notes text
);

ALTER TABLE public.advance_directives ADD COLUMN IF NOT EXISTS patient_decree_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL;
ALTER TABLE public.advance_directives ADD COLUMN IF NOT EXISTS power_of_attorney_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL;
ALTER TABLE public.advance_directives ADD COLUMN IF NOT EXISTS care_directive_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL;
ALTER TABLE public.advance_directives ADD COLUMN IF NOT EXISTS bank_power_of_attorney_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL;
ALTER TABLE public.advance_directives ADD COLUMN IF NOT EXISTS patient_decree_location_encrypted boolean DEFAULT false;
ALTER TABLE public.advance_directives ADD COLUMN IF NOT EXISTS power_of_attorney_holder_encrypted boolean DEFAULT false;
ALTER TABLE public.advance_directives ADD COLUMN IF NOT EXISTS care_directive_location_encrypted boolean DEFAULT false;
ALTER TABLE public.advance_directives ADD COLUMN IF NOT EXISTS bank_power_of_attorney_holder_encrypted boolean DEFAULT false;
ALTER TABLE public.advance_directives ADD COLUMN IF NOT EXISTS notes_encrypted boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS public.funeral_wishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  burial_type text,
  burial_location text,
  ceremony_type text,
  ceremony_wishes text,
  music_wishes text,
  flowers_wishes text,
  additional_wishes text,
  has_funeral_insurance boolean DEFAULT false,
  funeral_insurance_provider text,
  funeral_insurance_number text
);

ALTER TABLE public.funeral_wishes ADD COLUMN IF NOT EXISTS burial_location_encrypted boolean DEFAULT false;
ALTER TABLE public.funeral_wishes ADD COLUMN IF NOT EXISTS ceremony_wishes_encrypted boolean DEFAULT false;
ALTER TABLE public.funeral_wishes ADD COLUMN IF NOT EXISTS music_wishes_encrypted boolean DEFAULT false;
ALTER TABLE public.funeral_wishes ADD COLUMN IF NOT EXISTS flowers_wishes_encrypted boolean DEFAULT false;
ALTER TABLE public.funeral_wishes ADD COLUMN IF NOT EXISTS additional_wishes_encrypted boolean DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'documents_reminder_watcher_id_fkey'
      AND conrelid = 'public.documents'::regclass
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_reminder_watcher_id_fkey
      FOREIGN KEY (reminder_watcher_id) REFERENCES public.trusted_persons(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_user_category ON public.documents(user_id, category);
CREATE INDEX IF NOT EXISTS idx_documents_subcategory ON public.documents(subcategory_id) WHERE subcategory_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_custom_category ON public.documents(custom_category_id) WHERE custom_category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_reminder_watcher ON public.documents(reminder_watcher_id) WHERE reminder_watcher_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trusted_persons_user_id ON public.trusted_persons(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_persons_rls_check ON public.trusted_persons (user_id, linked_user_id, invitation_status, is_active) WHERE invitation_status = 'accepted' AND is_active = true;
CREATE INDEX IF NOT EXISTS unique_trusted_person_email_per_user ON public.trusted_persons(user_id, LOWER(email)) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON public.reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON public.reminders(due_date);
CREATE INDEX IF NOT EXISTS idx_reminders_watcher ON public.reminders(reminder_watcher_id) WHERE reminder_watcher_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subcategories_user_id ON public.subcategories(user_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_parent ON public.subcategories(user_id, parent_category);
CREATE INDEX IF NOT EXISTS idx_custom_categories_user_id ON public.custom_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_email ON public.emergency_contacts(email);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_documents_updated_at ON public.documents;
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_trusted_persons_updated_at ON public.trusted_persons;
CREATE TRIGGER update_trusted_persons_updated_at BEFORE UPDATE ON public.trusted_persons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_medical_info_updated_at ON public.medical_info;
CREATE TRIGGER update_medical_info_updated_at BEFORE UPDATE ON public.medical_info FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_emergency_contacts_updated_at ON public.emergency_contacts;
CREATE TRIGGER update_emergency_contacts_updated_at BEFORE UPDATE ON public.emergency_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_advance_directives_updated_at ON public.advance_directives;
CREATE TRIGGER update_advance_directives_updated_at BEFORE UPDATE ON public.advance_directives FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_funeral_wishes_updated_at ON public.funeral_wishes;
CREATE TRIGGER update_funeral_wishes_updated_at BEFORE UPDATE ON public.funeral_wishes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NULL))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trusted_persons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reminders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.subcategories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.custom_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.medical_info TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.emergency_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.advance_directives TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.funeral_wishes TO authenticated;

GRANT ALL PRIVILEGES ON TABLE public.profiles TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.documents TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.trusted_persons TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.reminders TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.subcategories TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.custom_categories TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.medical_info TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.emergency_contacts TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.advance_directives TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.funeral_wishes TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advance_directives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funeral_wishes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_profiles_select_self ON public.profiles;
DROP POLICY IF EXISTS rls_profiles_insert_self ON public.profiles;
DROP POLICY IF EXISTS rls_profiles_update_self ON public.profiles;
DROP POLICY IF EXISTS rls_profiles_service_role ON public.profiles;
CREATE POLICY rls_profiles_select_self ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY rls_profiles_insert_self ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY rls_profiles_update_self ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY rls_profiles_service_role ON public.profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can read own documents" ON public.documents;
DROP POLICY IF EXISTS "Trusted persons can read owner documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
CREATE POLICY "Users can read own documents" ON public.documents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Trusted persons can read owner documents" ON public.documents FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.trusted_persons tp
    WHERE tp.user_id = documents.user_id
      AND tp.linked_user_id = auth.uid()
      AND tp.invitation_status = 'accepted'
      AND tp.is_active = true
  )
);
CREATE POLICY "Users can insert own documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own documents" ON public.documents FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON public.documents FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own trusted persons" ON public.trusted_persons;
DROP POLICY IF EXISTS "Users can insert their own trusted persons" ON public.trusted_persons;
DROP POLICY IF EXISTS "Users can update their own trusted persons" ON public.trusted_persons;
DROP POLICY IF EXISTS "Users can delete their own trusted persons" ON public.trusted_persons;
CREATE POLICY "Users can view their own trusted persons" ON public.trusted_persons FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own trusted persons" ON public.trusted_persons FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own trusted persons" ON public.trusted_persons FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own trusted persons" ON public.trusted_persons FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own reminders" ON public.reminders;
DROP POLICY IF EXISTS "Users can insert their own reminders" ON public.reminders;
DROP POLICY IF EXISTS "Users can update their own reminders" ON public.reminders;
DROP POLICY IF EXISTS "Users can delete their own reminders" ON public.reminders;
CREATE POLICY "Users can view their own reminders" ON public.reminders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own reminders" ON public.reminders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own reminders" ON public.reminders FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own reminders" ON public.reminders FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own subcategories" ON public.subcategories;
DROP POLICY IF EXISTS "Users can create own subcategories" ON public.subcategories;
DROP POLICY IF EXISTS "Users can update own subcategories" ON public.subcategories;
DROP POLICY IF EXISTS "Users can delete own subcategories" ON public.subcategories;
CREATE POLICY "Users can view own subcategories" ON public.subcategories FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own subcategories" ON public.subcategories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subcategories" ON public.subcategories FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own subcategories" ON public.subcategories FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own custom categories" ON public.custom_categories;
DROP POLICY IF EXISTS "Users can create own custom categories" ON public.custom_categories;
DROP POLICY IF EXISTS "Users can update own custom categories" ON public.custom_categories;
DROP POLICY IF EXISTS "Users can delete own custom categories" ON public.custom_categories;
CREATE POLICY "Users can view own custom categories" ON public.custom_categories FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own custom categories" ON public.custom_categories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own custom categories" ON public.custom_categories FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own custom categories" ON public.custom_categories FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own medical info" ON public.medical_info;
DROP POLICY IF EXISTS "Users can insert own medical info" ON public.medical_info;
DROP POLICY IF EXISTS "Users can update own medical info" ON public.medical_info;
DROP POLICY IF EXISTS "Users can delete own medical info" ON public.medical_info;
CREATE POLICY "Users can view own medical info" ON public.medical_info FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own medical info" ON public.medical_info FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own medical info" ON public.medical_info FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own medical info" ON public.medical_info FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own emergency contacts" ON public.emergency_contacts;
DROP POLICY IF EXISTS "Users can insert own emergency contacts" ON public.emergency_contacts;
DROP POLICY IF EXISTS "Users can update own emergency contacts" ON public.emergency_contacts;
DROP POLICY IF EXISTS "Users can delete own emergency contacts" ON public.emergency_contacts;
CREATE POLICY "Users can view own emergency contacts" ON public.emergency_contacts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own emergency contacts" ON public.emergency_contacts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own emergency contacts" ON public.emergency_contacts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own emergency contacts" ON public.emergency_contacts FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own advance directives" ON public.advance_directives;
DROP POLICY IF EXISTS "Users can insert own advance directives" ON public.advance_directives;
DROP POLICY IF EXISTS "Users can update own advance directives" ON public.advance_directives;
DROP POLICY IF EXISTS "Users can delete own advance directives" ON public.advance_directives;
CREATE POLICY "Users can view own advance directives" ON public.advance_directives FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own advance directives" ON public.advance_directives FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own advance directives" ON public.advance_directives FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own advance directives" ON public.advance_directives FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own funeral wishes" ON public.funeral_wishes;
DROP POLICY IF EXISTS "Users can insert own funeral wishes" ON public.funeral_wishes;
DROP POLICY IF EXISTS "Users can update own funeral wishes" ON public.funeral_wishes;
DROP POLICY IF EXISTS "Users can delete own funeral wishes" ON public.funeral_wishes;
CREATE POLICY "Users can view own funeral wishes" ON public.funeral_wishes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own funeral wishes" ON public.funeral_wishes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own funeral wishes" ON public.funeral_wishes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own funeral wishes" ON public.funeral_wishes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.check_document_limits()
RETURNS TRIGGER AS $$
DECLARE
  sub_status text;
  doc_count int;
  max_docs int;
BEGIN
  SELECT subscription_status INTO sub_status
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF sub_status IS NULL OR sub_status = 'canceled' THEN
    max_docs := 10;
    SELECT count(*) INTO doc_count FROM public.documents WHERE user_id = NEW.user_id;
    IF doc_count >= max_docs THEN
      RAISE EXCEPTION 'Document limit reached for Free Tier (% documents max). Please upgrade to upload more.', max_docs;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_document_limit ON public.documents;
CREATE TRIGGER enforce_document_limit BEFORE INSERT ON public.documents FOR EACH ROW EXECUTE FUNCTION public.check_document_limits();

CREATE OR REPLACE FUNCTION public.update_storage_used_on_document_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles
      SET storage_used = COALESCE(storage_used, 0) + NEW.file_size
      WHERE id = NEW.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles
      SET storage_used = GREATEST(0, COALESCE(storage_used, 0) - OLD.file_size)
      WHERE id = OLD.user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_storage_used ON public.documents;
CREATE TRIGGER trg_storage_used
AFTER INSERT OR DELETE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.update_storage_used_on_document_change();

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('documents', 'documents', false, 26214400)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage'
      AND c.relname = 'objects'
      AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  END IF;
END
$$;

DROP POLICY IF EXISTS "Users can read own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Trusted persons can read owner documents in storage" ON storage.objects;

CREATE POLICY "Users can read own documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
