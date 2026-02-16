Bitte behebe alle Layout-Probleme in der Mobile- und Tablet-Ansicht.

AKTUELLES PROBLEM:
- Inhalte laufen horizontal aus dem Screen
- Icons, Header-Elemente und Dokumenten-Listen sind abgeschnitten
- Besonders im einfachen (Senioren-)Modus ist das Layout kaputt
- Texte, Icons und Karten passen nicht mehr in den Viewport

ZIEL:
- KEIN horizontaler Overflow auf irgendeinem Gerät
- Saubere Darstellung auf:
  - Mobile (≤ 640px)
  - Tablet (641px–1024px)
- Normale Ansicht UND einfacher Modus müssen stabil funktionieren

WICHTIG:
- Kein Redesign
- Keine neuen Features
- Keine neue Logik
- Nur Layout, CSS, Breakpoints, Flex/Grid-Korrekturen

========================
1. GLOBALER FIX (PFLICHT)
========================

- Stelle sicher:
  - `html, body { overflow-x: hidden; }`
- Jede Haupt-Layout-Container-Komponente:
  - `max-width: 100vw`
  - `overflow-x: hidden`

Kein Element darf breiter als der Viewport sein.

========================
2. MOBILE-FIRST ZWANG
========================

- Setze Mobile (<640px) als Basis
- Desktop-Regeln dürfen Mobile NICHT überschreiben
- Entferne fixe Breiten:
  - keine `width: 600px`
  - keine `min-width` auf Karten oder Listen
- Nutze:
  - `width: 100%`
  - `max-width: 100%`
  - `flex-wrap: wrap`

========================
3. HEADER & ICONS (KRITISCH)
========================

- Icons dürfen NIE:
  - absolut positioniert außerhalb des Containers sein
- Header:
  - muss innerhalb des Viewports bleiben
  - keine negativen Margins
- Bei Mobile:
  - Icons ggf. umbrechen oder nach unten verschieben
  - KEIN Abschneiden

========================
4. DOKUMENTENLISTEN (KRITISCH)
========================

- Dokumenten-Karten:
  - dürfen niemals breiter als der Screen sein
- Lange Dateinamen:
  - umbrechen ODER ellipsis
- Metadaten (Kategorie, Größe, Datum):
  - bei Mobile untereinander statt nebeneinander

KEIN horizontales Scrollen in Listen.

========================
5. FORMULARE & MODALS
========================

- Upload-Dialoge:
  - volle Breite auf Mobile
  - keine festen Höhen
- Inputs:
  - `width: 100%`
- Buttons:
  - nicht aus dem Screen laufen
  - Sticky-Buttons nur, wenn sie in den Viewport passen

========================
6. SENIOREN-MODUS (SEHR WICHTIG)
========================

- `.senior-mode`:
  - darf Schrift & Abstände vergrößern
  - darf Layout NICHT sprengen
- Alle Container:
  - müssen auch mit größeren Fonts stabil bleiben
- Falls nötig:
  - Abstände reduzieren, wenn Schrift wächst
  - niemals Breiten erhöhen

Senioren-Modus = Skalierung nach innen, nicht nach außen.

========================
7. BREAKPOINTS
========================

Verwende exakt:
- Mobile: <640px
- Tablet: 640px–1024px
- Desktop: >1024px

Tablet darf NICHT das Desktop-Layout erzwingen.

========================
8. TESTKRITERIEN (PFLICHT)
========================

Nach Umsetzung muss gelten:
- Kein horizontales Scrollen
- Kein abgeschnittener Text
- Kein Icon außerhalb des Screens
- Alles nutzbar mit einer Hand (Daumen)
- Einfacher Modus funktioniert auf Mobile

========================
AUSGABE
========================

Bitte:
1. Beschreibe kurz die Hauptursachen der Probleme
2. Liste die wichtigsten CSS/Layout-Änderungen
3. Implementiere die Fixes minimal und systematisch
