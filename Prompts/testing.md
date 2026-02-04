Implementiere Tests für das neue Family-Dashboard.

EMPFEHLUNG
- Playwright für E2E (Login + Family Flow)
- Vitest für Permission-Logik

TESTFÄLLE
1) Family Member + Basic Owner
   - Dokumente sichtbar
   - Download disabled
2) Family Member + Premium Owner
   - Einzel-Download möglich
   - ZIP-Download möglich
3) Owner
   - Export-Bereich unverändert

TECHNISCH
- Supabase mocking
- Keine echten Stripe Calls
- Testdaten minimal halten

LIEFERE:
- Ordnerstruktur
- Beispiel-Testfälle
- Empfehlung für CI-Integration
