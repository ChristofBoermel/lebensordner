Bitte behebe das Problem, dass Dokumente ohne Namen
in der Dokumentenliste angezeigt werden.

AKTUELLES PROBLEM:
- Unten in der Liste erscheinen Dokumente ohne Titel
- Diese Einträge sind Duplikate von Dokumenten,
  die weiter oben korrekt mit Namen angezeigt werden
- Die namenlosen Einträge sollen NICHT angezeigt werden

WICHTIG:
- Es handelt sich NICHT um echte leere Dokumente
- Es sind dieselben Dokumente, die doppelt gerendert werden
- Lösung darf kein reines UI-Hide sein

========================
1. URSACHE FINDEN (PFLICHT)
========================

Bitte prüfe:
- Welche Datenquelle(n) die Dokumentenliste speisen
- Ob Dokumente mehrfach gemappt / gemerged werden
- Ob:
  - Dokumente ohne `title`
  - oder mit leerem String
  - oder mit `null/undefined`
  doppelt durch die Render-Logik laufen

========================
2. RENDER-LOGIK KORRIGIEREN
========================

In der Dokumentenliste gilt:
- Dokumente ohne gültigen Namen dürfen NICHT angezeigt werden

Ein gültiger Name ist:
- `title` existiert
- `title.trim().length > 0`

Dokumente, die diese Bedingung nicht erfüllen:
- NICHT rendern
- NICHT als eigene Karten anzeigen

========================
3. DUPLIKATE VERHINDERN
========================

Falls dieselben Dokumente:
- aus mehreren Arrays kommen
- oder mehrfach kombiniert werden

Dann:
- Duplikate anhand einer eindeutigen ID entfernen
- Jedes Dokument darf nur EINMAL gerendert werden

========================
4. KEINE NEBENWIRKUNGEN
========================

- Dokumente mit Namen dürfen NICHT verschwinden
- Keine Änderung an:
  - Sortierung
  - Filterlogik
  - Kategorien
- Keine UI-Änderungen

========================
TESTKRITERIEN (PFLICHT)
========================

Nach Fix:
- Keine leeren Dokument-Karten mehr unten
- Jedes Dokument erscheint genau einmal
- Liste enthält nur Einträge mit sichtbarem Titel

========================
AUSGABE
========================

Bitte:
1. Erkläre kurz, warum die namenlosen Duplikate entstanden sind
2. Zeige, wo die Filter-/Dedup-Logik angepasst wurde
3. Implementiere den Fix minimal
