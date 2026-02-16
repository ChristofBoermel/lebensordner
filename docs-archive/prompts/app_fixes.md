Bitte behebe gezielt die verbleibenden Mobile-Layout-Probleme,
ohne neue Layout-Änderungen oder Redesigns einzuführen.

WICHTIG:
- Nur gezielte Korrekturen
- Keine neuen Features
- Keine globale Neustrukturierung
- Bestehende Fixes NICHT rückgängig machen

========================
1. „DOKUMENT HINZUFÜGEN“-BUTTON (NORMALER MODUS)
========================

PROBLEM:
- Button ist im Mobile-Viewport nicht korrekt aligned
- Wirkt visuell vom Content getrennt

FIX:
- Button muss im Mobile:
  - entweder `width: 100%` haben
  - oder klar links am Content ausgerichtet sein
- Kein Floating / kein Desktop-Alignment
- Button darf nicht über den Viewport hinausragen

========================
2. DOKUMENTEN-VIEWER (MOBILE)
========================

PROBLEM:
- Dokument / Bild ist zu groß
- Viewport wird ignoriert
- Nutzer muss unnötig scrollen

FIX:
- Viewer muss:
  - max-width: 100%
  - max-height: 100vh (oder Viewport minus Header)
- Inhalte müssen:
  - innerhalb des Screens skalieren
  - nicht überlaufen
- Kein horizontales Scrollen
- Zoom darf den Screen nicht sprengen

========================
3. UPLOAD-DIALOG (MODAL)
========================

PROBLEM:
- Links Padding vorhanden, rechts nicht
- Modal nicht sauber zentriert

FIX:
- Modal auf Mobile:
  - gleichmäßiger horizontaler Padding links & rechts
  - zentriert im Viewport
  - `max-width: 100%`
- Kein Element darf über den rechten Rand hinausragen

========================
4. DATUMS-PICKER (KALENDER) – KRITISCH
========================

PROBLEM:
- Dialog ist zu groß für Mobile
- Desktop-Layout wird erzwungen
- Schnellwahl-Buttons laufen aus dem Screen

FIX:
- Auf Mobile:
  - Kalender darf max. Viewport-Breite nutzen
  - Buttons müssen umbrechen oder untereinander stehen
  - Kein horizontaler Overflow
- Dialog:
  - darf scrollen, wenn Höhe nicht reicht
  - darf den Screen nicht sprengen

========================
5. SENIOREN-MODUS KOMPATIBILITÄT
========================

- Alle Fixes müssen auch mit `.senior-mode` funktionieren
- Größere Schrift darf:
  - NICHT zu Overflow führen
  - NICHT Layout sprengen
- Falls nötig:
  - Abstände reduzieren statt Breiten erhöhen

========================
TESTKRITERIEN (PFLICHT)
========================

Nach Umsetzung:
- Kein Element läuft links oder rechts aus dem Screen
- Alle Modals sind symmetrisch gepolstert
- Kalender vollständig nutzbar auf Mobile
- Dokumenten-Viewer passt sich dem Screen an
- Normaler Modus UND einfacher Modus stabil

========================
AUSGABE
========================

Bitte:
1. Beschreibe kurz, welche Komponenten betroffen waren
2. Liste die konkreten CSS/Layout-Fixes
3. Implementiere die Änderungen minimal
