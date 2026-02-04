Bitte implementiere eine kosten- und missbrauchssichere Speicherbegrenzung
für Datei-Uploads mit Supabase Storage.

ZIEL:
- So wenig laufende Kosten wie möglich
- Klare technische Limits pro User
- Fair-Use-konform
- Keine UX-Änderungen außer Fehlermeldungen/Hinweisen

RAHMEN:
- Next.js App Router
- Supabase (Auth, DB, Storage)
- Uploads dürfen NICHT direkt clientseitig in Supabase erfolgen

========================
1. DATENBANK
========================

Erweitere die Tabelle `profiles` um folgende Felder:

- storage_used_bytes BIGINT DEFAULT 0
- storage_limit_bytes BIGINT DEFAULT 0

Limits pro Plan:
- Free:    100 MB
- Basic:   500 MB
- Premium: 4 GB (Hard Cap, Fair Use)

========================
2. UPLOAD-GATE (PFLICHT)
========================

Alle Datei-Uploads müssen über eine eigene API-Route laufen
(z. B. /api/upload).

Ablauf beim Upload:
1. Nutzer authentifizieren
2. Datei-Validierung:
   - erlaubte Typen: PDF, JPG, PNG
   - maximale Dateigröße: 25 MB
3. Prüfen:
   storage_used_bytes + file.size <= storage_limit_bytes
4. Wenn Limit überschritten:
   - Upload abbrechen
   - verständliche Fehlermeldung zurückgeben
5. Wenn OK:
   - Datei in privaten Supabase Storage Bucket hochladen
   - storage_used_bytes in der DB erhöhen

Uploads dürfen NICHT stattfinden,
wenn das Speicherlimit überschritten würde.

========================
3. STORAGE-REGELN
========================

- Storage Bucket: privat
- Zugriff nur über Signed URLs
- Keine öffentlichen Uploads
- Keine Videos, keine ZIPs

========================
4. LÖSCHEN VON DATEIEN
========================

Beim Löschen einer Datei:
- tatsächliche Dateigröße ermitteln
- storage_used_bytes entsprechend reduzieren
- Konsistenz sicherstellen

========================
5. SOFT-WARNUNGEN (OPTIONAL, NUR LOGIK)
========================

Berechne im Code den Speicherverbrauch in Prozent:

- >= 70 % → Hinweis möglich
- >= 90 % → deutlicher Hinweis
- 100 % → Upload blockieren

KEINE neuen UI-Komponenten bauen,
nur die Logik bereitstellen.

========================
6. SICHERHEIT
========================

- RLS sicherstellen:
  Nutzer dürfen nur ihr eigenes Profil lesen/ändern
- storage_used_bytes darf nur serverseitig geändert werden
- Keine Client-Manipulation möglich

========================
7. WICHTIGE REGELN
========================

- Keine neuen Features
- Keine neue UX
- Kein Over-Engineering
- Kein externer Storage (S3 etc.)
- Fokus: minimal, robust, kostensicher

========================
AUSGABE
========================

Bitte:
1. Erkläre kurz, welche Dateien du anpasst/neu erstellst
2. Implementiere dann die Lösung minimal
