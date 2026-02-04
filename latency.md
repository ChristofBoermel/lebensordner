Bitte optimiere die App gezielt auf niedrige Latenz
und schnelle wahrgenommene Ladezeiten.

ZIEL:
- Schnelle Reaktionszeiten auf Tablet & Smartphone
- Keine langen Wartezeiten bei Navigation, Uploads, Listen
- Fokus auf wahrgenommene Geschwindigkeit (Perceived Performance)

RAHMEN:
- Next.js App Router
- Supabase (DB, Storage, Auth)
- Keine neuen Features
- Kein Design-Refactor
- Minimal-invasive Änderungen

========================
1. DATENLADUNG & FETCHING
========================

- Prüfe alle Server Components und API-Routen:
  - Vermeide unnötige DB-Queries
  - Kombiniere Queries, wo sinnvoll
- Nutze:
  - `select()` nur mit benötigten Feldern
  - keine `select *`
- Verhindere N+1 Queries

========================
2. CACHING (KRITISCH)
========================

- Setze sinnvolles Caching ein:
  - `revalidate` oder `cache()` bei Server Components
  - Statische Daten (z. B. Navigation, Einstellungen) cachen
- User-spezifische Daten:
  - nur neu laden, wenn sie sich ändern müssen

========================
3. LAZY LOADING & CODE SPLITTING
========================

- Große Komponenten lazy laden:
  - Dialoge
  - Modals
  - selten genutzte Bereiche
- Onboarding, Einstellungen, große Listen:
  - nicht im Initial Bundle laden

========================
4. LOADING STATES (PERCEIVED PERFORMANCE)
========================

- Überall dort, wo Daten geladen werden:
  - sofort sichtbare Skeletons / Platzhalter
- Kein „leerer Bildschirm“
- Ladezustände müssen:
  - ruhig
  - stabil
  - nicht flackern

========================
5. API-ROUTEN & SERVERLESS
========================

- Prüfe API-Routen:
  - Keine schweren Berechnungen im Request
  - Keine unnötigen JSON-Transformationen
- Wo möglich:
  - Logik in die DB (z. B. einfache Aggregationen)
- Vermeide Cold-Start-Kosten:
  - keine unnötigen Imports
  - keine großen Libraries in API-Routen

========================
6. UPLOADS & DATEIEN
========================

- Uploads:
  - Fortschrittsanzeige sofort anzeigen
  - UI darf nie „einfrieren“
- Nach Upload:
  - Optimistisches UI (Datei sofort anzeigen)
  - Server-Update im Hintergrund

========================
7. MESSBARKEIT
========================

- Markiere im Code kritische Pfade
- Optional:
  - einfache `console.time()` / `performance.now()`
  - keine externen Monitoring-Tools hinzufügen

========================
WICHTIGE REGELN
========================

- Keine neue Infrastruktur
- Keine neuen Abhängigkeiten
- Keine Vorab-Optimierung ohne Nutzen
- Fokus: reale Wartezeiten reduzieren

========================
AUSGABE
========================

Bitte:
1. Liste die wichtigsten Latenz-Bottlenecks auf
2. Erkläre kurz jede Optimierung
3. Implementiere sie minimal
