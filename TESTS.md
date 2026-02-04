# Test Setup für Lebensordner

## Ordnerstruktur

```
├── src/
│   ├── lib/
│   │   └── permissions/
│   │       └── family-permissions.test.ts # Unit Tests (Rollen & Berechtigungen)
│   └── test/
│       └── setup.ts                   # Test Setup (Mocks)
├── tests/
│   └── e2e/
│       ├── family-dashboard.spec.ts   # E2E Tests (Legacy/Real DB)
│       └── family-mocked.spec.ts      # E2E Tests (Mocked API)
├── vitest.config.ts
├── playwright.config.ts
└── package.json
```

## NPM Scripts

```bash
# Alle Tests (Unit + E2E)
npm run test

# Nur Unit Tests
npm run test:unit
npm run test:unit:watch     # Mit Watch Mode

# Nur E2E Tests
npm run test:e2e
npm run test:e2e:ui         # Mit UI für Debugging
npm run test:e2e:debug      # Mit Debugger
```

## Unit Tests (Vitest)

**Ort**: `src/lib/__tests__/permissions.test.ts`

**Fokus**: Rollen & Berechtigungen - keine Mock-Hölle

```typescript
// Testfälle:
✓ canDownload=false bei Basic Owner
✓ canDownload=true bei Premium Owner  
✓ Kein Zugriff für non-family members
✓ Voller Zugriff für Owner
✓ emergency_contact ≠ family_member
```

**Ausführung**:
```bash
npm run test:unit
```

## E2E Tests (Playwright)

**Ort**: `tests/e2e/family-dashboard.spec.ts`

**Testfälle**:

### 1) Family Member + Basic Owner
- ✅ /family lädt
- ✅ Dokumente sichtbar
- ✅ Download disabled
- ✅ Mobile (375px) Layout funktioniert

### 2) Family Member + Premium Owner
- ✅ Einzel-Download möglich
- ✅ ZIP-Download möglich
- ✅ Mobile (375px) Multi-Select funktioniert

### 3) Owner
- ✅ Redirect zu Dashboard
- ✅ /family nicht direkt aufrufbar
- ✅ Export-Bereich unverändert verfügbar

**Ausführung**:
```bash
# Alle E2E Tests
npm run test:e2e

# Nur Mobile Tests
npx playwright test --project="Mobile Chrome"

# Einzelne Test-Datei
npx playwright test family-dashboard.spec.ts
```

## Viewports

- **Desktop**: 1280x720
- **Mobile**: 375x667 (iPhone SE)

## Mocking

### Supabase (Unit Tests)
```typescript
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}))
```

### Stripe
- Keine echten Stripe Calls
- Subscription-Status über Mock-Daten

## CI-Integration

```yaml
# .github/workflows/test.yml
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:unit

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      with:
        node-version: '20'
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
```

## Installation

```bash
# Dependencies
npm install

# Playwright Browser
npx playwright install chromium

# Testausführung
npm run test
```

## Best Practices

1. **Keine Mock-Hölle** - Fokus auf kritische Berechtigungslogik
2. **Deterministisch** - Gleiche Testdaten, gleiche Ergebnisse
3. **Mobile First** - 375px Viewport explizit testen
4. **CI-tauglich** - Keine externen Abhängigkeiten
