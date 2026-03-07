# Root to `apps/web` Migration Plan (No-Implementation Runbook)

## Goal
Move the existing Next.js web app from repository root into `apps/web` while keeping behavior, deployment, and CI outcomes unchanged.

This document is a step-by-step migration plan only. It does not apply changes.

## Preconditions
- Current branch is clean or changes are stashed/committed.
- Existing checks are green on baseline:
  - `npm run lint`
  - `npm run type-check`
  - `npm test`
- Turborepo/workspaces are already present (as currently scaffolded).

## Migration Strategy
Use a two-stage migration:
1. **File move + local config alignment**
2. **CI/deploy path and command alignment**

Avoid combining logic refactors with structural move.

## Stage 1: Move App to `apps/web`

### 1. Create target app boundaries
- Ensure `apps/web` contains:
  - app source directories (`src`, `public`)
  - app config files (`next.config.js`, `postcss.config.js`, `tailwind.config.ts`, `next-env.d.ts`)
  - app runtime entry files (`middleware.ts` if used by Next app)
  - app test config files if they are web-specific

### 2. Decide what stays at root
- Keep root-level monorepo/tooling files:
  - `package.json` (workspace root)
  - `turbo.json`
  - shared CI/repo files (`.github/`, `.claude/`, `docs/`, `scripts/`)
- Move web-specific files from root into `apps/web`.

### 3. Update `apps/web/package.json`
- Replace wrapper scripts (`--prefix ../..`) with native scripts:
  - `dev`: `next dev`
  - `build`: `next build`
  - `start`: `next start`
  - `lint`: app-specific lint command
  - `type-check`: app-specific type-check command
  - `test`: app-specific tests (if kept per app)

### 4. Update TypeScript and aliasing
- In `apps/web/tsconfig.json`:
  - set `baseUrl` to local app root
  - update `paths` for `@/*` to map to `./src/*` (inside `apps/web`)
  - restrict include/exclude to app-local files
- Ensure imports resolve from `apps/web` without relying on root-relative path assumptions.

### 5. Move/correct env loading assumptions
- Ensure runtime env usage still works with app in `apps/web`.
- If scripts load `.env` from root, explicitly define env-file strategy for:
  - local dev
  - CI build
  - production deploy

### 6. Update test runners
- Point Vitest/Playwright configs to new app location where needed.
- Preserve existing test commands or split:
  - web unit/integration tests under `@repo/web`
  - root repo audit scripts still from root.

## Stage 2: CI and Deploy Updates

## CI (`.github/workflows/ci.yml`)

### 1. Dependency install
- Keep `npm ci` at repo root (workspace install).

### 2. Command migration
- Replace root web commands with workspace-targeted commands:
  - `npm run lint` -> `npm run lint --workspace @repo/web`
  - `npm run type-check` -> `npm run type-check --workspace @repo/web`
  - `npm run test` -> `npm run test --workspace @repo/web` (if tests moved)
  - `npm run build` -> `npm run build --workspace @repo/web`
- For multi-workspace validation, prefer:
  - `npx turbo run lint type-check test`
  - `npx turbo run build --filter=@repo/web`

### 3. Cache path updates
- Next cache path:
  - from `.next/cache`
  - to `apps/web/.next/cache`
- Keep Playwright browser cache unchanged unless runner changes.

### 4. Path filters
- Update trigger `paths` / `paths-ignore` rules to include:
  - `apps/web/**`
  - `packages/**` (shared changes affecting web)
- Avoid missing web runs due to old root-only assumptions.

## Deploy (`.github/workflows/deploy.yml`)

### 1. Docker build context assumptions
- If Dockerfile currently expects root app files, either:
  - update Dockerfile to copy/build from `apps/web`, or
  - keep context root but adjust build commands to workspace scripts.

### 2. Build command updates
- Update build steps to run workspace command:
  - `npm run build --workspace @repo/web`
  - or Turbo equivalent filtered to web.

### 3. Runtime start command
- Ensure deployment runtime starts the web app from new location/script.

## Stage 3: Root Script Rationalization
- Keep root scripts for repo-wide audits/ops.
- Add/keep convenience scripts:
  - `dev:web`
  - `build:web`
  - `test:web`
  - `lint:web`
  - `type-check:web`
- Route all through workspace commands to avoid ambiguity.

## Validation Checklist
- Local:
  - `npm run dev --workspace @repo/web` starts app successfully
  - `npm run build --workspace @repo/web` passes
  - `npm run type-check --workspace @repo/web` passes
  - `npm run lint --workspace @repo/web` passes
- Turbo:
  - `npx turbo run type-check` passes for all intended packages
  - `npx turbo run build --filter=@repo/web` passes
- CI:
  - All jobs in `ci.yml` pass with updated paths/commands
  - E2E job still builds and runs with new app location
- Deploy:
  - image build succeeds
  - smoke-check succeeds

## Rollback Plan
- Revert migration commit(s) that moved files and modified workflows.
- Restore previous root-based CI/build commands.
- Re-run baseline checks to confirm pre-migration behavior is restored.

## Risks to Watch
- Broken import aliases due to stale `baseUrl`/`paths`.
- CI cache misses or false misses due to wrong cache path.
- Docker build failures from outdated COPY/build paths.
- E2E failures due to wrong build directory or startup command.

## Recommended Execution Order
1. Prepare `apps/web` final config (without deleting root files yet).
2. Move files in one structural commit.
3. Fix `apps/web` scripts/config in one commit.
4. Update CI/deploy workflows in one commit.
5. Run full validation and then remove obsolete root web files.
