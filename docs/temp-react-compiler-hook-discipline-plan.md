# Temporary Plan: React Compiler Hook Discipline (Global)

## Goal

Establish a global repository policy for React Compiler usage:

- Avoid `useMemo`, `useCallback`, and `React.memo` in most cases.
- Avoid `useEffect` and `useRef` unless there is a concrete lifecycle/imperative need.

## Scope

- Applies to React code in this repository where React Compiler is enabled.
- Current focus: web app codebase first.
- Expo/RN rollout can be planned later as a separate phase.

## Policy

Default behavior:

- Prefer compiler-first code.
- Prefer pure render logic and direct function declarations.
- Avoid manual memoization and effect/ref hooks by default.

Allowed exceptions:

- I/O
- subscription lifecycle
- imperative sync/interop

Required inline exception comments:

- `// allowed: io - <reason>`
- `// allowed: subscription - <reason>`
- `// allowed: imperative-sync - <reason>`

## Lint Strategy

Phase 1 (warn-only):

- Add warnings for new usage of `useMemo`, `useCallback`, `React.memo`, `useEffect`, and `useRef`.
- Allow exception comments for justified cases.

Phase 2 (cleanup):

- Remove unnecessary hook usage in Expo/RN modules.
- Keep only justified exception sites.

Phase 3 (enforce):

- Move rules from warning to error once baseline is reduced.

## Migration Checklist

1. Add/maintain global React Compiler rule file under `.claude/rules`.
2. Ensure `AGENTS.md` mandatory rule list includes this Expo rule.
3. Implement lint rules in warn mode.
4. Refactor obvious unnecessary hook usage in current web app surfaces.
5. Flip lint severity to error after cleanup.

## Verification

- `npm run lint`
- `npm run type-check`
- Run affected web test or smoke flows where available.

## Rollback

- Revert lint severity from error/warn to previous state.
- Revert hook refactors that introduced regressions.
- Keep rule file and plan doc as reference unless explicitly removed.
