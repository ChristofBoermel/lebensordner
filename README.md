# Lebensordner Digital

Der sichere digitale Lebensorganisator für Ihre persönlichen Unterlagen und Vorsorgeinformationen.

## 🎯 Über das Projekt

Lebensordner Digital ist eine sichere Web-Plattform für die Organisation wichtiger Lebensunterlagen. Die Zielgruppe sind Erwachsene 58-75 Jahre und deren erwachsene Kinder (40-55), die ihre persönlichen Dokumente und Notfall-Informationen strukturiert verwalten möchten.

### Hauptfunktionen

- **Dokumenten-Kategorien**: Identität, Finanzen, Versicherungen, Wohnen, Gesundheit, Verträge, Rente & Pension
- **Notfall-Informationen**: Wichtige Kontakte, medizinische Daten, Handlungsanweisungen
- **Vertrauenspersonen**: Kontrollierter Zugriff für Familienmitglieder im Notfall
- **Übersichtlichkeit**: Klares, gut lesbares Design für die Zielgruppe

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Sprache**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI + Custom Components
- **Backend**: Supabase (Auth, Database, Storage)
- **Icons**: Lucide React

## 🚀 Erste Schritte

### Voraussetzungen

- Node.js 18+
- npm oder yarn
- Supabase Account

### Installation

1. **Repository klonen**
   ```bash
   git clone <repository-url>
   cd lebensordner
   ```

2. **Abhängigkeiten installieren**
   ```bash
   npm install
   ```

3. **Umgebungsvariablen konfigurieren**
   ```bash
   cp .env.example .env.local
   ```
   
   Füllen Sie die Variablen aus:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. **Supabase-Datenbank einrichten**
   
   Führen Sie das Schema in Ihrem Supabase SQL Editor aus:
   ```bash
   # Inhalt von supabase/schema.sql kopieren und ausführen
   ```

5. **Entwicklungsserver starten**
   ```bash
   npm run dev
   ```

6. **Browser öffnen**
   
   Navigieren Sie zu [http://localhost:3000](http://localhost:3000)

## 📁 Projektstruktur

```
lebensordner/
├── src/
│   ├── app/                    # Next.js App Router Pages
│   │   ├── (auth)/            # Auth-geschützte Routen (Login, Register)
│   │   ├── (dashboard)/       # Dashboard-Bereich
│   │   ├── layout.tsx         # Root Layout
│   │   ├── page.tsx           # Landing Page
│   │   └── globals.css        # Global Styles
│   ├── components/
│   │   ├── ui/                # Wiederverwendbare UI-Komponenten
│   │   └── layout/            # Layout-Komponenten
│   ├── lib/
│   │   ├── supabase/          # Supabase Client & Server
│   │   └── utils.ts           # Utility-Funktionen
│   └── types/
│       └── database.ts        # TypeScript Types & Enums
├── supabase/
│   └── schema.sql             # Datenbank-Schema
├── public/                    # Statische Dateien
└── ...config files
```

## 🔐 Supabase Setup

### 1. Neues Projekt erstellen

Erstellen Sie ein neues Projekt auf [supabase.com](https://supabase.com).

### 2. Datenbank-Schema ausführen

Kopieren Sie den Inhalt von `supabase/schema.sql` in den SQL Editor und führen Sie ihn aus.

### 3. Storage Bucket konfigurieren

Das Schema erstellt automatisch einen `documents` Bucket. Stellen Sie sicher, dass RLS aktiviert ist.

### 4. Auth konfigurieren

- Aktivieren Sie Email-Auth
- Konfigurieren Sie die Redirect URLs für Ihre Domain
- Optional: E-Mail-Templates auf Deutsch anpassen

## 🎨 Design-System

Das Design verwendet ein warmes, vertrauenswürdiges Farbschema:

- **Sage Green**: Primärfarbe (#627362)
- **Warm Gray**: Sekundärfarbe
- **Cream**: Hintergrund

Schriften:
- **Source Sans 3**: UI-Texte
- **Source Serif 4**: Überschriften

## 📋 Verfügbare Scripts

```bash
npm run dev        # Entwicklungsserver
npm run build      # Production Build
npm run start      # Production Server
npm run lint       # ESLint ausführen
npm run type-check # TypeScript prüfen
```

## 🗺️ Roadmap

### Phase 1 (Aktuell)
- ✅ Authentifizierung
- ✅ Dashboard
- ✅ Dokumenten-Verwaltung
- ⬜ Profil-Vervollständigung

### Phase 2
- ⬜ Notfall-Informationen
- ⬜ Vertrauenspersonen
- ⬜ Erinnerungen

### Phase 3
- ⬜ Zugriffskontrolle
- ⬜ PDF-Export
- ⬜ Druckfunktion
- ⬜ Stripe Integration

## 🔒 Sicherheit

- Ende-zu-Ende Verschlüsselung für Dokumente
- Row Level Security (RLS) in Supabase
- Server-seitige Authentifizierung
- DSGVO-konform durch EU-Hosting

## 📄 Lizenz

Proprietär - Alle Rechte vorbehalten.

## 📞 Support

Bei Fragen wenden Sie sich an: support@lebensordner.de
