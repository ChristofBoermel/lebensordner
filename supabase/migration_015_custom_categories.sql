-- Migration 015: Custom Categories
-- Ermöglicht Benutzern, eigene Kategorien zu erstellen

-- Custom Categories Tabelle
CREATE TABLE IF NOT EXISTS public.custom_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'folder',
  UNIQUE(user_id, name)
);

-- Index für schnelle Abfragen
CREATE INDEX IF NOT EXISTS idx_custom_categories_user_id ON public.custom_categories(user_id);

-- Custom-Category-Referenz in documents Tabelle
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS custom_category_id UUID REFERENCES public.custom_categories(id) ON DELETE SET NULL;

-- Index für Dokumente nach Custom-Kategorie
CREATE INDEX IF NOT EXISTS idx_documents_custom_category ON public.documents(custom_category_id) WHERE custom_category_id IS NOT NULL;

-- RLS (Row Level Security) für custom_categories
ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;

-- Policy: Benutzer können nur ihre eigenen Custom-Kategorien sehen
CREATE POLICY "Users can view own custom categories" ON public.custom_categories
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Benutzer können eigene Custom-Kategorien erstellen
CREATE POLICY "Users can create own custom categories" ON public.custom_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Benutzer können eigene Custom-Kategorien aktualisieren
CREATE POLICY "Users can update own custom categories" ON public.custom_categories
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Benutzer können eigene Custom-Kategorien löschen
CREATE POLICY "Users can delete own custom categories" ON public.custom_categories
  FOR DELETE USING (auth.uid() = user_id);

-- Kommentar zur Tabelle
COMMENT ON TABLE public.custom_categories IS 'Benutzerdefinierte Dokumenten-Kategorien';
COMMENT ON COLUMN public.custom_categories.name IS 'Name der Custom-Kategorie';
COMMENT ON COLUMN public.custom_categories.description IS 'Optionale Beschreibung';
COMMENT ON COLUMN public.custom_categories.icon IS 'Lucide-Icon Name für die UI';
