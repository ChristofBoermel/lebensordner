# Turborepo Monorepo Plan (Next.js Web + Expo Mobile)

## Summary
Build a Turborepo monorepo with:
- `apps/web` = existing Next.js app (migration phase)
- `apps/mobile` = Expo React Native app (iOS + Android)
- shared packages for domain logic/types/API contracts

Goal: maintain feature parity across web and mobile while minimizing duplicated logic and speeding up local and CI tasks.

## Implementation Changes

### 1. Repository Structure
```txt
/
  apps/
    web/
    mobile/
  packages/
    shared/
    config-eslint/
    config-typescript/
    ui-native/
  turbo.json
  package.json
```

### 2. Turborepo Setup
- Use workspaces for `apps/*` and `packages/*`.
- Add `turbo.json` with cacheable `build`, `lint`, `type-check`, and `test` pipelines.
- Keep `dev` uncached and persistent.
- Add remote cache in CI after local workflow is stable.

### 3. Mobile App (Expo)
- Keep Expo as the mobile stack in `apps/mobile`.
- Configure mobile scripts for `dev`, `ios`, `android`, `web`, `type-check`, and `build`.
- Consume shared package exports from `@repo/shared`.

### 4. Shared Code Boundaries
- Move platform-agnostic code to `packages/shared`:
  - types
  - schemas
  - API contracts/client helpers
  - pure domain logic
- Keep platform-specific UI and runtime integration inside each app.

### 5. CI/CD Evolution
- Move to Turbo orchestration for workspace-aware tasks:
  - `turbo run lint type-check test`
- Keep web E2E as-is initially.
- Add mobile E2E in a later phase (Detox or Maestro).

## Public APIs / Interfaces / Types
- Shared workspace package namespace:
  - `@repo/shared`
- Shared contracts should be consumed by both web and mobile to preserve feature parity.
- Existing backend endpoints remain backward-compatible during migration.

## Test Plan
- Baseline checks:
  - root web `type-check`, `lint`, `test`, `build`
- Workspace checks:
  - `turbo run type-check`
  - `turbo run lint`
  - `turbo run test`
- Mobile smoke checks:
  - `npm run dev --workspace @repo/mobile`
  - `npm run android --workspace @repo/mobile`
  - `npm run ios --workspace @repo/mobile` (macOS only)

## Assumptions and Defaults
- Mobile stack is Expo managed workflow.
- Backend remains in the current web app initially.
- Feature parity is incremental, not a big-bang migration.
- Shared domain logic is prioritized before cross-platform UI abstraction.
