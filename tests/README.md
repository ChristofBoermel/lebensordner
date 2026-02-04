# Lebensordner Test Suite

This directory contains the test infrastructure for the Lebensordner application, built using Vitest with React Testing Library.

## Test Structure

```
tests/
├── setup.ts                           # Global test setup, MSW initialization
├── mocks/
│   ├── supabase.ts                   # MSW handlers for Supabase API mocking
│   └── supabase-state.ts             # Mutable state for mock data
├── fixtures/
│   └── stripe.ts                     # Stripe price ID test constants & helpers
├── api/
│   └── webhook.test.ts               # Stripe webhook handler tests
├── components/
│   └── tier-status-card.test.tsx     # Component tests for TierStatusCard
├── integration/
│   ├── tier-detection-flow.test.ts   # End-to-end tier detection tests
│   └── debug-tools-flow.test.tsx     # Debug tools workflow integration tests
├── pages/
│   ├── abo.test.tsx                  # Abo page tier detection tests
│   ├── abo-debug-panel.test.tsx      # Abo debug panel UI tests
│   ├── admin-stats.test.tsx          # Admin stats dashboard tests
│   ├── admin-users.test.tsx          # Admin user management tests
│   └── einstellungen-tier.test.tsx   # Settings tier display tests
│   └── zugriff.test.tsx              # Integration tests for Zugriff page
├── subscription-tier.test.ts          # Unit tests for tier detection logic
├── utils/
│   ├── debug-helpers.ts              # Shared debug test utilities
│   └── tier-detection-logging.test.ts # Console logging tests
└── README.md                          # This file
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npx vitest tests/subscription-tier.test.ts
```

## Test Categories

### Unit Tests (`subscription-tier.test.ts`)

Tests for the `getTierFromSubscription()` function in `src/lib/subscription-tiers.ts`:

- **Premium Tier Detection**: Verifies correct tier detection for premium subscriptions
- **Basic Tier Detection**: Verifies correct tier detection for basic subscriptions
- **Family Tier Detection**: Verifies family tier price IDs are treated as premium tier
- **Free Tier Detection**: Verifies correct tier detection for free/no subscriptions
- **Edge Cases**: Tests for missing price IDs, unrecognized price IDs, etc.
- **Logging Tests**: Verifies appropriate warnings/logs for tier detection issues

### API Tests (`api/webhook.test.ts`)

Tests for the Stripe webhook handler:

- **checkout.session.completed**: Price ID extraction and profile update
- **customer.subscription.created/updated**: Subscription data storage
- **customer.subscription.deleted**: Subscription cancellation handling
- **Price ID extraction**: Verifies correct extraction from subscription items
- **Error handling**: Invalid signatures, missing data

### Integration Tests (`integration/tier-detection-flow.test.ts`)

End-to-end tests for the complete tier detection flow:

- **Complete data flow**: Webhook → Database → Client → UI
- **All tier types**: Basic, Premium, Family (as premium)
- **Subscription lifecycle**: Upgrades, downgrades, cancellations
- **Feature verification**: Correct limits for each tier

### Debug Tools Tests

#### Abo Debug Panel (`pages/abo-debug-panel.test.tsx`)

- Debug panel renders only in development mode
- Subscription fields display correctly
- Known price IDs section renders all tiers
- Refresh button triggers subscription reload

#### Admin Dashboard (`pages/admin-stats.test.tsx`)

- Admin access control
- Platform statistics rendering
- Loading and error states
- Refresh updates statistics

#### Admin User Management (`pages/admin-users.test.tsx`)

- User table columns and rows
- Search filtering by name/email
- Subscription/onboarding badges
- Role changes via RPC
- Storage/date formatting and empty state

#### Settings Tier Display (`pages/einstellungen-tier.test.tsx`)

- Current tier display
- Storage usage indicator
- Upgrade prompts for free/basic users
- Premium badge for premium users
- Tier updates after subscription changes

#### Console Logging (`utils/tier-detection-logging.test.ts`)

- `getTierFromSubscription` logs and warnings for tier detection

#### Integration Flow (`integration/debug-tools-flow.test.tsx`)

- Abo debug panel → refresh → admin dashboard → search
- Console warnings during flow for unknown price IDs

### Component Tests (`components/tier-status-card.test.tsx`)

Tests for the `TierStatusCard` and `InfoBadge` components:

- Visual display of tier information
- Correct text and icons for each tier
- Color scheme verification
- Variant rendering (compact vs default)

### Integration Tests (`pages/zugriff.test.tsx`)

End-to-end tests for the tier detection flow:

- Premium subscription displays "Premium" in UI
- Basic subscription displays "Basis" in UI
- Free subscription displays "Kostenlos" in UI
- **Bug reproduction test**: Verifies Premium subscriptions do NOT incorrectly display as "Basis"

### Dokumente Upload Tests

Tests for tier-gated reminder watcher feature in document upload:
- Tier-based UI visibility (Free/Basic/Premium)
- Security validation (client + server)
- Mobile responsiveness
- API tier validation

Run: `npm test tests/pages/dokumente.test.tsx`

## Test Fixtures

### Stripe Price IDs (`fixtures/stripe.ts`)

Test constants that match the environment variables:

- `STRIPE_PRICE_BASIC_MONTHLY` = `price_basic_monthly_test`
- `STRIPE_PRICE_BASIC_YEARLY` = `price_basic_yearly_test`
- `STRIPE_PRICE_PREMIUM_MONTHLY` = `price_premium_monthly_test`
- `STRIPE_PRICE_PREMIUM_YEARLY` = `price_premium_yearly_test`

These are configured in `tests/setup.ts` as environment variables.

## Mocking Strategy

### Supabase Client

The Supabase client is mocked using Vitest's `vi.mock()`:

- Auth methods return a mock authenticated user
- Database queries return mock profile data
- Mock profile data can be configured per-test using helper functions

### MSW (Mock Service Worker)

MSW is configured to intercept HTTP requests:

- Supabase REST API endpoints are mocked
- Authentication endpoints return mock tokens
- Profile queries return configurable mock data

## Known Issues / Bug Reproduction

The integration tests include a critical test case that reproduces the Premium subscription bug:

```typescript
describe('Premium Subscription Bug Reproduction', () => {
  it('CRITICAL: Premium subscription should NOT display as Basis', () => {
    // This test verifies that premium subscriptions
    // correctly display as "Premium" and not "Basis"
  })
})
```

If this test fails, it indicates the bug has regressed.

## Adding New Tests

1. **Unit tests**: Add to the appropriate test file or create a new `.test.ts` file
2. **Component tests**: Add to `tests/components/` directory
3. **Integration tests**: Add to `tests/pages/` directory
4. **New mock data**: Update `tests/mocks/supabase.ts` or create new fixture files

## Configuration

### Vitest Config (`vitest.config.ts`)

- Test environment: `jsdom`
- Global test utilities enabled
- Path alias: `@/` maps to `./src/`
- Setup file: `tests/setup.ts`

### Environment Variables

Set automatically in `tests/setup.ts`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `STRIPE_PRICE_*` constants
