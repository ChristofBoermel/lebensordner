Bitte optimiere das UI vollständig für Tablet und Smartphone,
sowohl im normalen Modus als auch im einfachen (Senioren-)Modus.

ZIEL:
- Perfekte Nutzbarkeit auf:
  - Smartphone (Portrait)
  - Tablet (Portrait & Landscape)
- Keine horizontale Scrollbar
- Große, sichere Touch-Zonen
- Konsistentes Verhalten in beiden Modi

RAHMEN:
- Bestehende UX & Struktur beibehalten
- Keine neuen Features
- Kein Redesign
- Nur Layout, Spacing, Breakpoints, Touch-Optimierung

========================
1. BREAKPOINTS
========================

Bitte definiere klare Breakpoints:
- Mobile: < 640px
- Tablet: 640px – 1024px
- Desktop: > 1024px

Layouts müssen auf jedem Breakpoint sinnvoll sein.

========================
2. NAVIGATION
========================

- Mobile:
  - Navigation gut erreichbar (Daumen-Zone)
  - Keine zu kleinen Icons
- Tablet:
  - Mehr Platz nutzen
  - Keine Desktop-Zwangslayouts

Text + Icon immer sichtbar.

========================
3. TOUCH & INTERAKTION
========================

- Alle klickbaren Elemente:
  - mindestens 44x44px (normal)
  - mindestens 60x60px (einfacher Modus)
- Keine dichten Klickflächen
- Kein Hover-only Verhalten

========================
4. TYPOGRAFIE & ABSTÄNDE
========================

- Mobile:
  - kürzere Zeilen
  - größere Abstände
- Einfacher Modus:
  - bestehende größere Schrift respektieren
  - Layout darf nicht brechen

========================
5. FORMULARE
========================

- Inputs:
  - volle Breite auf Mobile
  - große Labels
- Kein Mehrspalten-Layout auf Mobile
- Fehler- & Hilfetexte direkt unter dem Feld

========================
6. MODALS & DIALOGE
========================

- Mobile:
  - Fullscreen oder Bottom-Sheet
  - Keine kleinen Popups
- Tablet:
  - zentriert, gut erreichbar

========================
7. SCROLL & OVERFLOW
========================

- Kein verschachteltes Scrollen
- Keine fixen Höhen, die Inhalte abschneiden
- Safe-Area (iOS) berücksichtigen

========================
WICHTIGE REGELN
========================

- Keine Logik ändern
- Keine neue State-Verwaltung
- Kein Entfernen von Features
- Einfacher Modus bleibt vollständig funktionsfähig

========================
AUSGABE
========================

Bitte:
1. Beschreibe kurz die wichtigsten Anpassungen
2. Implementiere sie schrittweise und minimal
