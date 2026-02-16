Erstelle eine GitHub Actions CI mit 2 Stufen für das Lebensordner-Repo.

STUFE 1 – Fast Checks
- Trigger: push + pull_request
- Läuft bei jedem Commit
- Enthält:
  - npm ci
  - lint
  - typecheck
  - unit tests (Vitest)
- Muss schnell sein (< 3 Minuten)

STUFE 2 – E2E
- Läuft nur, wenn Stufe 1 erfolgreich war
- Enthält:
  - Playwright
  - Headless Chromium
  - Mobile Viewport Tests
- Keine externen Services nötig

ANFORDERUNGEN
- Node 20
- Keine Secrets notwendig
- Klar getrennte Jobs
- Gut lesbare YAML

LIEFERE:
- Vollständige .github/workflows/ci.yml
- Kurze Erklärung der Jobs
