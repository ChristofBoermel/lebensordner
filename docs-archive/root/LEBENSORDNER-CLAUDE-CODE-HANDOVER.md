# Lebensordner Digital - Claude Code Handover

**Erstellt:** 18. Januar 2026
**Aktuelle Version:** v12.13
**Repository:** github.com/ChristofBoermel/lebensordner
**Domain:** https://www.lebensordner.org (Cloudflare)
**Hosting:** Vercel

---

## 📋 PROJEKT-ÜBERSICHT

### Was ist Lebensordner?

Ein **deutscher digitaler Lebensorganisator** für wichtige Dokumente und Notfall-Vorsorge. Zielgruppe sind vor allem Menschen 40+, die ihre wichtigen Unterlagen sicher digital speichern und im Notfall Vertrauenspersonen Zugriff geben wollen.

### Kernfunktionen (bereits implementiert)

1. **Dokumentenverwaltung** - Upload, Kategorisierung, Ablaufdatum-Tracking
2. **Vertrauenspersonen** - Einladung per Email, verschiedene Zugriffslevel
3. **Notfall-Informationen** - Medizinische Daten, Notfallkontakte
4. **Erinnerungen** - Dokumenten-Ablauf, eigene Erinnerungen, Email-Benachrichtigungen
5. **Subscription-System** - 4 Tiers (Free, Basic, Premium, Family) via Stripe
6. **2FA** - TOTP mit Google Authenticator etc.
7. **Export** - PDF-Export, Vollständiges Backup als ZIP

---

## 🛠️ TECH STACK

### Frontend
- **Next.js 16** (App Router)
- **React 19**
- **TypeScript 5.9**
- **Tailwind CSS 3.4** mit Custom Theme (sage/warmgray/cream)
- **Shadcn/UI** Komponenten (Radix UI basiert)
- **Lucide React** Icons

### Backend
- **Supabase** (PostgreSQL, Auth, Storage, RLS)
- **Stripe** (Subscriptions, Webhooks)
- **Resend** (Transaktionale Emails)
- **Vercel** (Hosting, Cron Jobs)

### Analytics
- **PostHog** (Analytics, Event Tracking)

---

## 📁 PROJEKTSTRUKTUR

```
lebensordner/
├── src/
│   ├── app/
│   │   ├── (auth)/              # Auth-Seiten (Login, Register, Passwort)
│   │   │   ├── anmelden/
│   │   │   ├── registrieren/
│   │   │   ├── passwort-reset/
│   │   │   └── passwort-vergessen/
│   │   ├── (dashboard)/         # Geschützte Seiten
│   │   │   ├── abo/             # Subscription-Verwaltung
│   │   │   ├── admin/           # Admin-Bereich (nicht fertig)
│   │   │   ├── dashboard/       # Haupt-Dashboard
│   │   │   ├── dokumente/       # Dokumentenverwaltung
│   │   │   ├── einstellungen/   # Benutzereinstellungen
│   │   │   ├── erinnerungen/    # Erinnerungen
│   │   │   ├── export/          # Export/Backup
│   │   │   ├── notfall/         # Notfall & Vorsorge
│   │   │   ├── onboarding/      # Onboarding-Flow
│   │   │   └── zugriff/         # Vertrauenspersonen
│   │   ├── (public)/
│   │   │   └── einladung/[token]/ # Einladungslink für Vertrauenspersonen
│   │   ├── api/
│   │   │   ├── auth/2fa/        # 2FA Setup & Verify
│   │   │   ├── cron/            # Cron Jobs (Erinnerungen)
│   │   │   ├── invitation/      # Einladungs-API
│   │   │   ├── onboarding/      # Onboarding Complete
│   │   │   ├── profile/         # Profil-API
│   │   │   ├── stripe/          # Stripe Checkout & Webhook
│   │   │   └── trusted-person/  # Einladung senden
│   │   ├── auth/callback/       # Supabase Auth Callback
│   │   ├── agb/                 # AGB
│   │   ├── datenschutz/         # Datenschutz
│   │   └── page.tsx             # Landing Page
│   ├── components/
│   │   ├── ui/                  # Shadcn/UI Components
│   │   ├── auth/                # 2FA Setup Dialog
│   │   ├── consent/             # Cookie Consent
│   │   ├── error/               # Error Boundary
│   │   ├── layout/              # Dashboard Navigation
│   │   ├── loading/             # Skeleton Loading
│   │   ├── search/              # Global Search (⌘K)
│   │   └── theme/               # Dark Mode
│   ├── lib/
│   │   ├── supabase/            # Supabase Client (client, server, middleware)
│   │   ├── posthog/             # PostHog Analytics
│   │   ├── stripe.ts            # Stripe Client
│   │   ├── subscription-tiers.ts # Tier-Konfiguration
│   │   └── utils.ts             # Utility Functions
│   └── types/
│       └── database.ts          # TypeScript Types & Kategorien
├── supabase/
│   ├── schema.sql               # Initiales Schema
│   └── migration_001-013.sql    # Alle Migrationen
├── public/                      # Statische Assets
├── next.config.js
├── tailwind.config.ts
├── package.json
└── vercel.json                  # Cron Config
```

---

## 🗄️ DATENBANK-SCHEMA

### Tabellen

#### `profiles` (User-Profile)
```sql
- id UUID (= auth.users.id)
- email TEXT
- full_name TEXT
- phone TEXT
- date_of_birth DATE
- address TEXT
- onboarding_completed BOOLEAN
- storage_used BIGINT (Bytes)
- email_reminders_enabled BOOLEAN
- email_reminder_days_before INTEGER
- stripe_customer_id TEXT
- stripe_subscription_id TEXT
- stripe_price_id TEXT
- subscription_status TEXT
- subscription_current_period_end TIMESTAMPTZ
- two_factor_enabled BOOLEAN
- two_factor_secret TEXT
```

#### `documents`
```sql
- id UUID
- user_id UUID (FK profiles)
- category TEXT (identitaet, finanzen, versicherungen, wohnen, gesundheit, vertraege, rente)
- title TEXT
- notes TEXT
- file_name TEXT
- file_path TEXT (Supabase Storage)
- file_size BIGINT
- file_type TEXT
- expiry_date DATE
- expiry_reminder_sent BOOLEAN
```

#### `trusted_persons`
```sql
- id UUID
- user_id UUID (FK profiles)
- name TEXT
- email TEXT
- phone TEXT
- relationship TEXT
- access_level TEXT (immediate, emergency, after_confirmation)
- access_delay_hours INTEGER
- is_active BOOLEAN
- invitation_token TEXT (UNIQUE)
- invitation_status TEXT (pending, sent, accepted, declined)
- invitation_sent_at TIMESTAMPTZ
- invitation_accepted_at TIMESTAMPTZ
- linked_user_id UUID (FK profiles, nach Registrierung)
```

#### `reminders`
```sql
- id UUID
- user_id UUID (FK profiles)
- document_id UUID (FK documents, optional)
- title TEXT
- description TEXT
- due_date DATE
- is_completed BOOLEAN
- reminder_type TEXT (document_expiry, annual_review, custom)
- email_sent BOOLEAN
```

#### `emergency_contacts`
```sql
- id UUID
- user_id UUID (FK profiles)
- name TEXT
- phone TEXT
- relationship TEXT
- is_primary BOOLEAN
```

#### `medical_info`
```sql
- id UUID
- user_id UUID (FK profiles, UNIQUE)
- blood_type TEXT
- allergies TEXT[]
- medications TEXT[]
- conditions TEXT[]
- doctor_name TEXT
- doctor_phone TEXT
- insurance_number TEXT
- additional_notes TEXT
```

---

## 🔑 ENVIRONMENT VARIABLES

### Vercel (Production)
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ... (WICHTIG: Legacy API Key Tab!)

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_BASIC_MONTHLY=price_...
STRIPE_PRICE_BASIC_YEARLY=price_...
STRIPE_PRICE_PREMIUM_MONTHLY=price_...
STRIPE_PRICE_PREMIUM_YEARLY=price_...
STRIPE_PRICE_FAMILY_MONTHLY=price_...
STRIPE_PRICE_FAMILY_YEARLY=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Resend (Email)
RESEND_API_KEY=re_...

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=phc_...
POSTHOG_API_KEY=phx_...

# App
NEXT_PUBLIC_APP_URL=https://www.lebensordner.org

# Cron
CRON_SECRET=... (optional, für Cron-Authentifizierung)
```

### Lokal (.env.local)
```env
# Gleich, aber mit Test-Keys
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 📊 AKTUELLE SUBSCRIPTION TIERS

```typescript
// src/lib/subscription-tiers.ts

free: {
  maxDocuments: 10,
  maxStorageMB: 100,
  maxTrustedPersons: 1,  // ⚠️ SOLL AUF 0 GEÄNDERT WERDEN!
  emailReminders: false,
  documentExpiry: false,
  twoFactorAuth: false,
}

basic: {
  price: 4.90€/Monat, 49€/Jahr
  maxDocuments: 50,
  maxStorageMB: 500,
  maxTrustedPersons: 3,
  emailReminders: true,
  documentExpiry: true,
  twoFactorAuth: false,
}

premium: {
  price: 9.90€/Monat, 99€/Jahr  // ⚠️ SOLL AUF 11.90€ GEÄNDERT WERDEN!
  maxDocuments: unlimited,
  maxStorageMB: 2048,  // ⚠️ SOLL AUF 10GB (10240) GEÄNDERT WERDEN!
  maxTrustedPersons: 10,
  emailReminders: true,
  documentExpiry: true,
  twoFactorAuth: true,
}

family: {
  // ⚠️ SOLL KOMPLETT ENTFERNT WERDEN!
  // Premium ersetzt Family
}
```

---

## 🐛 BEKANNTE BUGS & EINSCHRÄNKUNGEN

### Gefixt in v12.1-12.13:
- ✅ Stripe Webhook 307 Redirect
- ✅ Stripe Webhook 500 (Date.toISOString Error)
- ✅ 2FA Verify Route (RLS bypass)
- ✅ 2FA Dialog springt zu "Disable" nach Aktivierung
- ✅ Onboarding Loop / onboarding_completed bleibt FALSE
- ✅ Email-Bestätigung ohne Resend-Option
- ✅ Vertrauenspersonen: Keine Einladungs-Email
- ✅ medical_info 406 Error
- ✅ Input Borders zu hell
- ✅ Datenschutz & AGB 404

### Offene Probleme:
- ⚠️ Admin-Bereich ist Platzhalter (nicht funktional)
- ⚠️ Emergency Access Flow ist konzeptionell vorbereitet, aber nicht komplett
- ⚠️ Vertrauensperson nach Registrierung wird nicht automatisch verknüpft

---

## 🆕 NEUE FEATURES (ZU IMPLEMENTIEREN)

### 1. Dokument-Kategorien erweitern
**Priorität: HOCH**

**Neue Standard-Kategorien hinzufügen:**
- `religion` - Religionszugehörigkeit
- `familie` - Familie (Geburtsurkunden, Heiratsurkunden, etc.)
- `arbeit` - Arbeit (Arbeitsverträge, Zeugnisse, etc.)

**Custom-Kategorien ermöglichen:**
- User können eigene Kategorien erstellen
- Free: 0 Custom-Kategorien
- Basic: 5 Custom-Kategorien
- Premium: Unlimited

**Kategorien löschbar machen:**
- Standard-Kategorien können versteckt werden
- Custom-Kategorien können gelöscht werden
- Dokumente in gelöschten Kategorien → "Sonstige" oder wählbar

**Datenbank-Änderung:**
```sql
CREATE TABLE custom_categories (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'folder',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE documents 
  ADD COLUMN custom_category_id UUID REFERENCES custom_categories(id);
```

---

### 2. Ordnerstruktur / Subkategorien
**Priorität: SEHR HOCH (Kernfeature)**

**Konzept:**
Wenn User eine Kategorie wählt (z.B. "Versicherungen"), soll er Subkategorien wählen können:
- Autoversicherung
- Hausratversicherung
- Krankenversicherung
- Haftpflicht
- ODER: Neue Subkategorie erstellen

**Tier-Limits:**
- Free: 5 Subkategorien total
- Basic: 15 Subkategorien
- Premium: Unlimited

**UI-Flow:**
1. Upload → Kategorie wählen → Subkategorie wählen/erstellen → Fertig
2. Dokumenten-Ansicht zeigt Ordnerstruktur (klappbar)

**Datenbank:**
```sql
CREATE TABLE subcategories (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  parent_category TEXT NOT NULL, -- z.B. 'versicherungen'
  name TEXT NOT NULL,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, parent_category, name)
);

ALTER TABLE documents 
  ADD COLUMN subcategory_id UUID REFERENCES subcategories(id);
```

---

### 3. Onboarding verbessern
**Priorität: HOCH**

**Probleme (Feedback von 48-jähriger Nutzerin):**
- "Später Hinzufügen" Button ist zu unauffällig
- Dokument-Hochladen-Schritt ist nicht intuitiv
- Kategorien-Auswahl fehlt im Onboarding

**Änderungen:**
1. "Später Hinzufügen" → **Bold, Schwarz, größer**
2. Dokument-Schritt: Beispiel-Kategorien mit Icons zeigen
3. Direktes Upload im Onboarding mit Kategorie-Auswahl ermöglichen
4. **Onboarding wiederholbar machen** (Button in Einstellungen)

---

### 4. Tier-Änderungen
**Priorität: HOCH**

**Free Tier:**
- Vertrauenspersonen: 1 → **0**
- Subkategorien: 5

**Basic Tier:**
- Custom-Kategorien: 5
- Subkategorien: 15

**Premium Tier:**
- Preis: 9.90€ → **11.90€**
- Speicher: 2GB → **10GB**
- Custom-Kategorien: Unlimited
- Subkategorien: Unlimited

**Family Tier:**
- **KOMPLETT ENTFERNEN**
- Premium übernimmt die Rolle

**Stripe-Änderungen nötig:**
- Neuen Premium-Preis in Stripe erstellen
- Family-Produkt archivieren
- Environment Variables updaten

---

### 5. SMS-Benachrichtigungen
**Priorität: MITTEL**

**Konzept:**
Neben Email auch SMS für Erinnerungen.

**Anbieter-Optionen:**
- Twilio
- MessageBird
- AWS SNS

**UI:**
- Toggle in Einstellungen: "SMS-Benachrichtigungen"
- Telefonnummer bereits vorhanden in Profil
- Zusätzlicher Toggle im Erinnerungs-Tab

**Kosten-Hinweis:**
SMS kostet Geld, eventuell nur für Premium?

---

### 6. Passwort-Änderung verbessern
**Priorität: MITTEL**

**Aktuell:** Neues Passwort setzen ohne altes zu prüfen

**Neu:** 
1. Altes Passwort eingeben
2. Altes Passwort verifizieren (Supabase Auth)
3. Neues Passwort + Bestätigung
4. Speichern

---

### 7. Profilbild
**Priorität: NIEDRIG**

**Konzept:**
- Avatar in Navigation und Dashboard
- Upload in Einstellungen
- Speicherung in Supabase Storage `avatars/{user_id}`

**UI:**
- Runder Avatar mit Initialen als Fallback
- Klick → Upload-Dialog

---

### 8. Feedback-Tab
**Priorität: MITTEL**

**Konzept:**
Dedizierter Bereich für User-Feedback direkt in der App.

**Felder:**
- Typ: Wunsch, Kritik, Lob, Bug
- Nachricht (Textarea)
- Optional: Email für Rückfragen

**Backend:**
- Speicherung in Datenbank
- Email an Admin bei neuem Feedback

**Seite:** `/feedback`

---

### 9. Notfall & Vorsorge erweitern
**Priorität: HOCH**

**Neue Felder:**
- **Organspendeausweis:** Ja/Nein/Unbekannt + wo aufbewahrt
- **Entscheidungsvollmacht:** Hat jemand Vollmacht? Wer? Kontaktdaten
- **Patientenverfügung:** Vorhanden? Wo?
- **Vorsorgevollmacht:** Vorhanden? Wer ist bevollmächtigt?

**Datenbank:**
```sql
ALTER TABLE medical_info ADD COLUMN organ_donor TEXT; -- 'yes', 'no', 'unknown'
ALTER TABLE medical_info ADD COLUMN organ_donor_card_location TEXT;

CREATE TABLE advance_directives (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  type TEXT NOT NULL, -- 'decision_authority', 'patient_directive', 'power_of_attorney'
  has_document BOOLEAN DEFAULT FALSE,
  document_location TEXT,
  authorized_person_name TEXT,
  authorized_person_phone TEXT,
  authorized_person_email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, type)
);
```

---

### 10. I-Akte Verknüpfung
**Priorität: NIEDRIG (Recherche nötig)**

**Frage vom User:** Kann man die I-Akte (digitale Gesundheitsakte) verknüpfen?

**Recherche nötig:**
- Was ist die I-Akte genau? (ePA?)
- Gibt es eine API?
- DSGVO-Konformität?

**Mögliche Ansätze:**
- Link zur I-Akte speichern
- PDF-Export aus I-Akte hochladen
- Tiefe Integration wahrscheinlich zu komplex

---

## 📝 AUSSTEHENDE MIGRATIONEN

Diese Migrationen müssen noch in Supabase ausgeführt werden:

```sql
-- Migration 011: 2FA Felder (falls nicht bereits vorhanden)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;
ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;

-- Migration 012: Medical Info Tabelle
-- (Siehe supabase/migration_012_medical_info.sql)

-- Migration 013: Trusted Person Invitation
ALTER TABLE public.trusted_persons 
ADD COLUMN IF NOT EXISTS invitation_token TEXT UNIQUE;
ADD COLUMN IF NOT EXISTS invitation_status TEXT DEFAULT 'pending';
ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMPTZ;
ADD COLUMN IF NOT EXISTS invitation_accepted_at TIMESTAMPTZ;
ADD COLUMN IF NOT EXISTS linked_user_id UUID REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_trusted_persons_invitation_token 
ON public.trusted_persons(invitation_token) 
WHERE invitation_token IS NOT NULL;
```

---

## 🔧 ENTWICKLUNGS-SETUP

### Lokal starten
```bash
cd lebensordner
npm install
cp .env.example .env.local  # Und Keys eintragen
npm run dev
```

### Build & Deploy
```bash
npm run build
# Vercel deployed automatisch bei Push zu main
```

### Wichtige Befehle
```bash
npm run dev          # Lokaler Dev Server
npm run build        # Production Build
npm run lint         # ESLint
npm run type-check   # TypeScript Check
```

---

## 🎨 DESIGN SYSTEM

### Farben (Tailwind)
```
sage-50 bis sage-900    - Grün (Primary)
warmgray-50 bis 900     - Grau (Text, Borders)
cream-50 bis cream-100  - Hintergrund
```

### Schriften
```
font-sans: Source Sans 3
font-serif: Source Serif 4
```

### Komponenten-Stil
- Warme, organische Farben
- Abgerundete Ecken (rounded-lg, rounded-xl)
- Subtile Schatten
- Keine harten Kontraste
- Zielgruppe: 40+ Jahre (gut lesbar!)

---

## 📞 SUPPORT & CONTEXT

### Feedback-Quelle
- 48-jährige Mutter des Entwicklers
- Echte Zielgruppen-Nutzerin
- Fokus auf Einfachheit und Übersichtlichkeit

### Wichtige Hinweise
1. **Supabase Service Role Key:** Immer den "Legacy API Key" aus dem alten Tab verwenden!
2. **Stripe Webhook URL:** Immer mit `www.` → `https://www.lebensordner.org/api/stripe/webhook`
3. **RLS:** Alle Tabellen haben Row Level Security, für Admin-Operationen Service Role Key nutzen
4. **Resend Domain:** `@lebensordner.org` ist verifiziert

---

## ✅ ZUSAMMENFASSUNG: NÄCHSTE SCHRITTE

### Phase 1: Tier-Änderungen (sofort)
1. Free Tier: Vertrauenspersonen auf 0
2. Family Tier entfernen
3. Premium: Preis auf 11.90€, Speicher auf 10GB
4. Stripe-Produkte aktualisieren

### Phase 2: Ordnerstruktur (Kernfeature)
1. Subkategorien-Tabelle erstellen
2. Upload-Flow mit Subkategorie-Auswahl
3. Dokumenten-Ansicht mit Ordnerstruktur
4. Tier-Limits für Subkategorien

### Phase 3: Custom-Kategorien
1. Custom-Kategorien-Tabelle
2. UI zum Erstellen/Löschen
3. Tier-Limits

### Phase 4: Onboarding & UX
1. "Später Hinzufügen" besser sichtbar
2. Dokument-Upload im Onboarding verbessern
3. Onboarding wiederholbar machen

### Phase 5: Notfall erweitern
1. Organspende-Felder
2. Vollmachten-System
3. advance_directives Tabelle

### Phase 6: Weitere Features
1. Feedback-Tab
2. Profilbild
3. SMS-Benachrichtigungen
4. Passwort-Änderung verbessern

---

**Viel Erfolg mit Claude Code! 🚀**

Bei Fragen einfach dieses Dokument als Kontext mitgeben.
