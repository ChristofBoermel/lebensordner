Implementiere eine neue Route `/family` für eingeladene Family Members.

ROUTING
- Pfad: src/app/(family)/family
- Owner darf diese Route nicht sehen
- Family Members sehen NUR diese Route (kein Dashboard, keine Settings)

UI / UX (sehr wichtig!)
- Read-only Ansicht
- Nutze bestehende `DocumentCard` Komponenten
- Große Buttons (min. 44px)
- Keine Icon-only Actions
- Klare Textlabels ("Dokument ansehen", "Download nicht verfügbar")

ACCESSIBILITY / SENIOREN
- Muss bei 200% Text-Zoom stabil bleiben
- Keine fixen Höhen
- Line-height ≥ 1.6
- Fokus-Ringe sichtbar
- Kein Hover-only Verhalten

RESPONSIVE
- Mobile: 1 Spalte
- Tablet: 2 Spalten
- Desktop: max. 3 Spalten (kein Grid-Overkill)

PERFORMANCE
- Server Components bevorzugen
- Suspense für Dokumentlisten
- Kein globaler State
- Keine unnötigen useEffect-Hooks

LIEFERE:
- Ordnerstruktur
- Beispiel Page + Layout
- Hinweise, welche bestehenden Komponenten angepasst werden müssen
