Du arbeitest im GitHub-Repository "lebensordner" (Next.js 16, App Router, Supabase).

WICHTIGE KLARSTELLUNG:
- Owner (zahlender User) kann IMMER alle Dokumente exportieren (bestehender Export-Bereich).
- Die neue Download-Logik gilt AUSSCHLIESSLICH für eingeladene Family Members im Family Dashboard.
- Es darf KEINE Änderung am bestehenden Owner-Export-Verhalten geben.

IMPLEMENTIERE:

1) DATENMODELL
- Erweitere die bestehende Tabelle `trusted_persons` minimal:
  - role: 'family_member'
- KEINE expliziten Permission-Felder (download/view)
- Download-Recht wird IMMER vom Subscription-Tier des OWNERS abgeleitet

2) PERMISSION-LOGIK (serverseitig)
- Wenn eingeloggter User == Owner → kein Check nötig
- Wenn eingeloggter User == Family Member:
  - owner.subscription === 'premium' → canDownload = true
  - owner.subscription === 'basic' → canDownload = false

3) SUPABASE RLS (high level)
- Family Members dürfen Dokument-Metadaten lesen
- Storage-Zugriff nur über serverseitige API-Routen (Signed URLs)
- Kein direkter Storage-Zugriff über Client

4) PERFORMANCE
- Keine zusätzlichen Joins pro Dokument
- Owner + Tier in einer Query laden
- Keine Client-Side Permission-Checks

LIEFERE:
- Konkrete Migration (SQL)
- Helper-Funktion `getFamilyPermissions(userId)`
- Empfehlung, wo diese Logik im Repo liegen soll (`src/lib/...`)
