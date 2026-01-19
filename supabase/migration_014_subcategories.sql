-- Migration 014: Subcategories (Ordnerstruktur)
-- Ermöglicht Subkategorien für bessere Dokumenten-Organisation

-- Subcategories Tabelle
CREATE TABLE IF NOT EXISTS public.subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_category TEXT NOT NULL, -- z.B. 'versicherungen', 'finanzen'
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'folder',
  UNIQUE(user_id, parent_category, name)
);

-- Index für schnelle Abfragen
CREATE INDEX IF NOT EXISTS idx_subcategories_user_id ON public.subcategories(user_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_parent ON public.subcategories(user_id, parent_category);

-- Subcategory-Referenz in documents Tabelle
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL;

-- Index für Dokumente nach Subkategorie
CREATE INDEX IF NOT EXISTS idx_documents_subcategory ON public.documents(subcategory_id) WHERE subcategory_id IS NOT NULL;

-- RLS (Row Level Security) für subcategories
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

-- Policy: Benutzer können nur ihre eigenen Subkategorien sehen
CREATE POLICY "Users can view own subcategories" ON public.subcategories
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Benutzer können eigene Subkategorien erstellen
CREATE POLICY "Users can create own subcategories" ON public.subcategories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Benutzer können eigene Subkategorien aktualisieren
CREATE POLICY "Users can update own subcategories" ON public.subcategories
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Benutzer können eigene Subkategorien löschen
CREATE POLICY "Users can delete own subcategories" ON public.subcategories
  FOR DELETE USING (auth.uid() = user_id);

-- Kommentar zur Tabelle
COMMENT ON TABLE public.subcategories IS 'Benutzerdefinierte Subkategorien für Dokumente (Ordnerstruktur)';
COMMENT ON COLUMN public.subcategories.parent_category IS 'Übergeordnete Kategorie (identitaet, finanzen, versicherungen, etc.)';
COMMENT ON COLUMN public.subcategories.name IS 'Name der Subkategorie (z.B. Autoversicherung, Krankenversicherung)';
COMMENT ON COLUMN public.subcategories.icon IS 'Lucide-Icon Name für die UI';
