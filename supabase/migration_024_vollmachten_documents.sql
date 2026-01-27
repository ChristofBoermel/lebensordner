-- Migration 024: Add document upload fields for Vollmachten
-- Allows linking uploaded documents to advance directives

ALTER TABLE public.advance_directives
ADD COLUMN IF NOT EXISTS patient_decree_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS power_of_attorney_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS care_directive_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS bank_power_of_attorney_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL;

-- Add indexes for document lookups
CREATE INDEX IF NOT EXISTS idx_advance_directives_patient_decree_doc ON public.advance_directives(patient_decree_document_id);
CREATE INDEX IF NOT EXISTS idx_advance_directives_power_of_attorney_doc ON public.advance_directives(power_of_attorney_document_id);
CREATE INDEX IF NOT EXISTS idx_advance_directives_care_directive_doc ON public.advance_directives(care_directive_document_id);
CREATE INDEX IF NOT EXISTS idx_advance_directives_bank_power_of_attorney_doc ON public.advance_directives(bank_power_of_attorney_document_id);

COMMENT ON COLUMN public.advance_directives.patient_decree_document_id IS 'Reference to uploaded Patientenverfügung document';
COMMENT ON COLUMN public.advance_directives.power_of_attorney_document_id IS 'Reference to uploaded Vorsorgevollmacht document';
COMMENT ON COLUMN public.advance_directives.care_directive_document_id IS 'Reference to uploaded Betreuungsverfügung document';
COMMENT ON COLUMN public.advance_directives.bank_power_of_attorney_document_id IS 'Reference to uploaded Bankvollmacht document';
