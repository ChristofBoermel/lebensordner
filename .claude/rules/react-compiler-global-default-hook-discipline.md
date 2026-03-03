---
title: React Compiler Global Default Hook Discipline
impact: HIGH
impactDescription: keeps React Compiler code simple and avoids unnecessary hook complexity across the codebase
tags: react-compiler, react, hooks, architecture
---

## React Compiler Global Default Hook Discipline

> **Scope:** All React surfaces in this repository where React Compiler is enabled.

When React Compiler is active, default to compiler-first patterns and avoid manual memoization patterns in most cases.

### Default Rules

- Do not add `useMemo`, `useCallback`, or `React.memo` by default.
- Do not add `useEffect` or `useRef` by default.
- Prefer pure render logic, derived values inline, and direct function declarations unless there is a concrete lifecycle or imperative requirement.

### Allowed Exceptions (must be explicit)

Only use `useEffect` / `useRef` / manual memoization when at least one applies:

- I/O: network, storage, or native async side effects.
- Subscription lifecycle: add/remove listeners, observers, streams, app state handlers.
- Imperative sync: timer handles, focus/measure APIs, interop with imperative third-party/native APIs, or correctness-critical stable identity.

Exception usage must include a concise reason comment directly above the line:

```tsx
// allowed: subscription - attach listener with cleanup
useEffect(() => {
  const unsubscribe = someSource.subscribe(onChange)
  return () => unsubscribe()
}, [])
```

```tsx
// allowed: imperative-sync - keep timeout handle across renders
const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
```

### Incorrect

```tsx
const styles = useMemo(() => createStyles(theme), [theme])
const onPress = useCallback(() => submit(form), [form])
```

### Correct

```tsx
const styles = createStyles(theme)
function onPress() {
  submit(form)
}
```

### Notes

- If a hook is required for correctness, keep it and document the reason inline.
- If React Compiler is not enabled in a specific package/module, document that explicitly before deviating.
