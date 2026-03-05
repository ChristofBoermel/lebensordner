# Senior Mode Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix broken senior mode (icon buttons invisible, dead Tailwind classes) and implement a full elderly-first UX redesign with larger touch targets, labeled actions, tap-reveal tooltips, better contrast, simplified layout, and contextual hints — CSS-only where possible, targeted JSX where required.

**Architecture:** All senior mode behaviour is toggled via the `.senior-mode` class on `<html>`. Tailwind utility classes with a `senior-mode:` prefix are used in JSX to layer responsive overrides, but this variant is not currently registered — registering it in `tailwind.config.ts` will activate 136 existing dead-code classes across 7 files at zero additional cost. A new `SeniorTooltip` component handles tap-reveal labels for icon-only buttons.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v3, Radix UI, Lucide React, CVA (class-variance-authority)

---

## Background: Bug Root Cause

The `globals.css` senior mode block has two critical errors:

1. **Icon button collapse** (`globals.css:463-467`):
   ```css
   .senior-mode button, .senior-mode [role="button"] {
     @apply px-6 py-4;   /* 24px left/right, 16px top/bottom */
   }
   ```
   The Button `size="icon"` variant is `h-12 w-12` (48px). With `box-sizing: border-box`, padding of 48px total horizontal collapses the content area to 0–12px, making SVG icons invisible.

2. **Dead `senior-mode:` Tailwind variant** (`tailwind.config.ts:127`):
   `plugins: []` — no variant registered. All 136 `senior-mode:text-xl`, `senior-mode:h-14`, `senior-mode:text-3xl` etc. across 7 files are inert. Registering the variant costs one line in config and activates everything instantly.

3. **Inline link `min-height`** (`globals.css:427-431`):
   `.senior-mode a { min-height: 60px; min-width: 60px; }` applies to ALL anchors including inline text links, breaking paragraph flow.

---

## Task 1: Register the `senior-mode` Tailwind variant

**Files:**
- Modify: `tailwind.config.ts`

This single change activates 136 existing dead-code `senior-mode:*` Tailwind classes across 7 files with zero JSX changes needed.

**Step 1: Read the current config**

Open `tailwind.config.ts`. Verify `plugins: []` at the bottom.

**Step 2: Implement — add the plugin**

Replace:
```ts
  plugins: [],
}
```

With:
```ts
  plugins: [
    require('tailwindcss/plugin')(function({ addVariant }: { addVariant: (name: string, definition: string) => void }) {
      addVariant('senior-mode', 'html.senior-mode &')
    }),
  ],
}
```

**Step 3: Verify the change builds**

Run: `npx next build --no-lint 2>&1 | tail -5`

Expected: No TypeScript or Tailwind errors. The build might warn about unused variants — that's fine.

Alternatively just start the dev server: `npx next dev` and confirm no compile errors.

**Step 4: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat(senior-mode): register senior-mode tailwind variant to activate 136 dead-code classes"
```

---

## Task 2: Fix icon button CSS bug + inline link height bug

**Files:**
- Modify: `src/app/globals.css` (lines 423–474)

**Step 1: Read the current senior mode CSS block**

Open `src/app/globals.css`. Locate the block `/* SENIOREN-MODUS */` at line ~395.

**Step 2: Replace the broken rules**

Find this exact block (lines 423–474):
```css
/* Senior Mode: Larger touch targets */
.senior-mode button,
.senior-mode [role="button"],
.senior-mode input[type="submit"],
.senior-mode input[type="button"],
.senior-mode a {
  min-height: 60px;
  min-width: 60px;
}

.senior-mode input:not([type="checkbox"]):not([type="radio"]),
.senior-mode textarea,
.senior-mode select {
  min-height: 56px;
  padding-top: 0.875rem;
  padding-bottom: 0.875rem;
}

/* Senior Mode: Enhanced focus states */
.senior-mode *:focus-visible {
  @apply ring-[3px] ring-offset-4;
}

/* Senior Mode: Larger icons in navigation and buttons */
.senior-mode nav svg,
.senior-mode button svg,
.senior-mode [role="button"] svg {
  width: 1.5rem;
  height: 1.5rem;
}

/* Senior Mode: Enhanced card spacing */
.senior-mode .card-elevated {
  @apply p-6;
}

.senior-mode .category-card {
  @apply p-8;
}

/* Senior Mode: Enhanced button padding */
.senior-mode button,
.senior-mode [role="button"] {
  @apply px-6 py-4;
}

/* Senior Mode: Larger checkbox and radio inputs */
.senior-mode input[type="checkbox"],
.senior-mode input[type="radio"] {
  width: 1.5rem;
  height: 1.5rem;
}
```

Replace with:
```css
/* Senior Mode: Larger touch targets for interactive elements (NOT inline links) */
.senior-mode button,
.senior-mode [role="button"],
.senior-mode input[type="submit"],
.senior-mode input[type="button"] {
  min-height: 60px;
  min-width: 60px;
}

/* Nav links get larger tap targets but inline <a> tags do NOT */
.senior-mode nav a,
.senior-mode [role="navigation"] a {
  min-height: 60px;
}

.senior-mode input:not([type="checkbox"]):not([type="radio"]),
.senior-mode textarea,
.senior-mode select {
  min-height: 56px;
  padding-top: 0.875rem;
  padding-bottom: 0.875rem;
}

/* Senior Mode: Enhanced focus states */
.senior-mode *:focus-visible {
  @apply ring-[3px] ring-offset-4;
}

/* Senior Mode: Larger icons in navigation */
.senior-mode nav svg {
  width: 1.5rem;
  height: 1.5rem;
}

/* Senior Mode: Icon-only buttons keep their explicit size — DO NOT pad them */
.senior-mode button[data-icon-button="true"] {
  padding: 0;
}

/* Senior Mode: Enhanced padding for TEXT buttons only (not icon buttons) */
.senior-mode button:not([data-icon-button="true"]),
.senior-mode [role="button"]:not([data-icon-button="true"]) {
  @apply px-6 py-4;
}

/* Senior Mode: Enhanced card spacing */
.senior-mode .card-elevated {
  @apply p-6;
}

.senior-mode .category-card {
  @apply p-8;
}

/* Senior Mode: Larger checkbox and radio inputs */
.senior-mode input[type="checkbox"],
.senior-mode input[type="radio"] {
  width: 1.5rem;
  height: 1.5rem;
}
```

**Step 3: Verify the fix logic**

The `data-icon-button="true"` attribute needs to be added to icon-only buttons in JSX (Task 3). The CSS is ready to act on it.

**Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "fix(senior-mode): fix icon button collapse and inline link min-height regression"
```

---

## Task 3: Mark icon-only buttons with `data-icon-button` attribute

**Files:**
- Modify: `src/components/ui/button.tsx`

The `Button` component already detects icon-only content (`isIconOnly` variable on line 42-45). We just need to pass the `data-icon-button` attribute when this is true.

**Step 1: Read the current button.tsx**

Open `src/components/ui/button.tsx`. Confirm `isIconOnly` detection logic at lines 42-45.

**Step 2: Add the data attribute**

Find:
```tsx
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        aria-label={ariaLabel}
        {...props}
      />
    )
```

Replace with:
```tsx
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        aria-label={ariaLabel}
        data-icon-button={isIconOnly ? 'true' : undefined}
        {...props}
      />
    )
```

**Step 3: Verify in browser**

Start dev server, enable senior mode, navigate to `/dokumente`. The Shield and Plus icon buttons should now be visible (60px circles with centered icons).

**Step 4: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "fix(senior-mode): mark icon-only buttons with data-icon-button to prevent padding collapse"
```

---

## Task 4: Senior mode CSS redesign — typography, contrast, density

**Files:**
- Modify: `src/app/globals.css`

This task adds the comprehensive senior mode visual improvements after the `/* SENIOREN-MODUS */` block.

**Step 1: Read the end of the senior mode block**

Open `src/app/globals.css`. Find the line after the last senior mode rule (currently `/* ONBOARDING ACCESSIBILITY MODE */` section, around line 476).

**Step 2: Add comprehensive enhancements**

Insert after the senior mode checkbox rule (`width: 1.5rem; height: 1.5rem;` for checkboxes) and before the `/* ONBOARDING ACCESSIBILITY MODE */` comment, add:

```css
/* Senior Mode: Boost low-contrast text colors */
.senior-mode .text-warmgray-300 { color: #6b635c; }  /* warmgray-600 */
.senior-mode .text-warmgray-400 { color: #524b46; }  /* warmgray-700 */
.senior-mode .text-warmgray-500 { color: #3d3835; }  /* warmgray-800 */

/* Senior Mode: Fix tiny badge text — minimum 14px */
.senior-mode [class*="text-[10px]"],
.senior-mode [class*="text-[11px]"],
.senior-mode [class*="text-xs"] {
  font-size: 0.9375rem !important;  /* 15px */
  line-height: 1.5 !important;
}

/* Senior Mode: Make card grids single-column on all screens */
.senior-mode .grid-cols-2,
.senior-mode .grid-cols-3,
.senior-mode .sm\:grid-cols-2,
.senior-mode .sm\:grid-cols-3,
.senior-mode .md\:grid-cols-2,
.senior-mode .md\:grid-cols-3,
.senior-mode .lg\:grid-cols-2,
.senior-mode .lg\:grid-cols-3 {
  grid-template-columns: 1fr !important;
}

/* Senior Mode: Wider max content area (less whitespace on sides) */
.senior-mode main {
  max-width: 52rem;
}

/* Senior Mode: Bolder section headings */
.senior-mode h1 { font-size: 2.25rem; font-weight: 700; }
.senior-mode h2 { font-size: 1.875rem; font-weight: 700; }
.senior-mode h3 { font-size: 1.5rem;  font-weight: 600; }

/* Senior Mode: Taller, more spacious category cards */
.senior-mode [class*="category-card"],
.senior-mode [class*="card-elevated"] {
  padding: 2rem;
  border-width: 2px;
}

/* Senior Mode: Thicker, more visible borders on inputs */
.senior-mode input:not([type="checkbox"]):not([type="radio"]),
.senior-mode textarea,
.senior-mode select {
  border-width: 2px;
  border-color: #a3b1a3;  /* sage-300 */
  font-size: 1.125rem;
}

/* Senior Mode: Active nav item is unmissable */
.senior-mode nav [aria-current="page"],
.senior-mode nav .bg-sage-50 {
  border-left: 4px solid #4d5c4d;
  padding-left: calc(1rem - 4px);
  font-weight: 700;
}

/* Senior Mode: Make primary action buttons larger */
.senior-mode button[data-variant="default"]:not([data-icon-button="true"]) {
  min-height: 72px;
  font-size: 1.25rem;
  font-weight: 600;
  border-radius: 0.75rem;
}

/* Senior Mode: Larger dialog content */
.senior-mode [role="dialog"] {
  padding: 2rem;
}

.senior-mode [role="dialog"] h2 {
  font-size: 1.75rem;
  margin-bottom: 1rem;
}

/* Senior Mode: Tooltip/popover content larger */
.senior-mode [data-radix-popper-content-wrapper] {
  font-size: 1.1rem;
}
```

**Step 3: Check for grid collapse side effects**

The grid-cols override uses `!important` because Tailwind responsive variants have high specificity. Verify at `/dokumente` that category cards stack vertically.

**Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(senior-mode): boost contrast, single-column grid, larger typography, spacious cards"
```

---

## Task 5: Tap-reveal tooltip for icon-only buttons in senior mode

**Files:**
- Create: `src/components/ui/senior-icon-tooltip.tsx`
- Modify: `src/app/(dashboard)/dokumente/page.tsx` (Shield + Plus buttons, ~line 301-336)

This component wraps an icon button. In normal mode: nothing added. In senior mode: tapping the button first shows a brief labeled tooltip, second tap executes the action.

**Step 1: Create the component**

Create `src/components/ui/senior-icon-tooltip.tsx`:

```tsx
'use client'

import { useState, useRef } from 'react'
import { useTheme } from '@/components/theme/theme-provider'
import { cn } from '@/lib/utils'

interface SeniorIconTooltipProps {
  label: string
  children: React.ReactElement<{
    onClick?: (e: React.MouseEvent) => void
    className?: string
  }>
  className?: string
}

export function SeniorIconTooltip({ label, children, className }: SeniorIconTooltipProps) {
  const { seniorMode } = useTheme()
  const [showLabel, setShowLabel] = useState(false)
  const labelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (!seniorMode) return children

  const handleClick = (e: React.MouseEvent) => {
    if (!showLabel) {
      // First tap: show label for 1.5 seconds
      e.preventDefault()
      e.stopPropagation()
      setShowLabel(true)
      // allowed: imperative-sync - hide label after delay
      labelTimerRef.current = setTimeout(() => setShowLabel(false), 1500)
    } else {
      // Second tap (or first if already shown): execute original action
      setShowLabel(false)
      if (labelTimerRef.current) clearTimeout(labelTimerRef.current)
      children.props.onClick?.(e)
    }
  }

  return (
    <div className={cn('relative inline-flex', className)}>
      {showLabel && (
        <div
          role="tooltip"
          className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-warmgray-900 px-3 py-1.5 text-sm font-medium text-white shadow-lg z-50"
          aria-live="polite"
        >
          {label}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-warmgray-900" />
        </div>
      )}
      {/* clone element, replacing onClick with our interceptor */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(children as any).type
        ? {
            ...children,
            props: {
              ...children.props,
              onClick: handleClick,
              'aria-label': label,
            },
          }
        : children}
    </div>
  )
}
```

Wait — cloning React elements manually is error-prone. Use `React.cloneElement`:

```tsx
'use client'

import { useState, useRef } from 'react'
import React from 'react'
import { useTheme } from '@/components/theme/theme-provider'
import { cn } from '@/lib/utils'

interface SeniorIconTooltipProps {
  /** Short German label shown on first tap in senior mode */
  label: string
  children: React.ReactElement<{
    onClick?: (e: React.MouseEvent) => void
    className?: string
  }>
  className?: string
}

/**
 * Wraps an icon-only button. In senior mode, the first tap shows a label
 * tooltip and the second tap (within 1.5 s) executes the original onClick.
 * Outside senior mode renders children unchanged.
 */
export function SeniorIconTooltip({ label, children, className }: SeniorIconTooltipProps) {
  const { seniorMode } = useTheme()
  const [showLabel, setShowLabel] = useState(false)
  // allowed: imperative-sync — hold timeout handle across renders
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (!seniorMode) return children

  const handleClick = (e: React.MouseEvent) => {
    if (!showLabel) {
      e.preventDefault()
      e.stopPropagation()
      setShowLabel(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setShowLabel(false), 1500)
    } else {
      setShowLabel(false)
      if (timerRef.current) clearTimeout(timerRef.current)
      children.props.onClick?.(e)
    }
  }

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      {showLabel && (
        <div
          role="tooltip"
          aria-live="polite"
          className="absolute -top-11 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-lg bg-warmgray-900 px-3 py-2 text-sm font-semibold text-white shadow-lg"
        >
          {label}
          <span
            aria-hidden="true"
            className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-warmgray-900"
          />
        </div>
      )}
      {React.cloneElement(children, {
        onClick: handleClick,
        'aria-label': label,
      } as Partial<typeof children.props>)}
    </div>
  )
}
```

**Step 2: Wrap the Shield button in dokumente/page.tsx**

Open `src/app/(dashboard)/dokumente/page.tsx`. Find the Shield button block (lines ~301-324):

```tsx
<Button
  size="icon"
  variant="ghost"
  className={`h-11 w-11 rounded-full transition-all ${
    isSecured
      ? "text-amber-600 bg-amber-100"
      : "text-warmgray-300 hover:text-sage-600 hover:bg-sage-50"
  } senior-mode:h-14 senior-mode:w-14`}
  onClick={(event) => onToggleCategoryLock(event, categoryKey)}
  disabled={toggleDisabled}
  title={
    toggleDisabled
      ? "Kategorie-Schutz ist in dieser Umgebung nicht verfugbar"
      : isSecured
        ? "Extra-Sicherheit deaktivieren"
        : "Extra-Sicherheit aktivieren"
  }
>
  {isSecured ? (
    <ShieldCheck className="w-6 h-6" />
  ) : (
    <Shield className="w-6 h-6" />
  )}
</Button>
```

Replace with:
```tsx
<SeniorIconTooltip
  label={isSecured ? "Sicherheit deaktivieren" : "Sicherheit aktivieren"}
>
  <Button
    size="icon"
    variant="ghost"
    className={`h-11 w-11 rounded-full transition-all ${
      isSecured
        ? "text-amber-600 bg-amber-100"
        : "text-warmgray-300 hover:text-sage-600 hover:bg-sage-50"
    } senior-mode:h-14 senior-mode:w-14`}
    onClick={(event) => onToggleCategoryLock(event, categoryKey)}
    disabled={toggleDisabled}
    title={
      toggleDisabled
        ? "Kategorie-Schutz ist in dieser Umgebung nicht verfügbar"
        : isSecured
          ? "Extra-Sicherheit deaktivieren"
          : "Extra-Sicherheit aktivieren"
    }
  >
    {isSecured ? (
      <ShieldCheck className="w-6 h-6" />
    ) : (
      <Shield className="w-6 h-6" />
    )}
  </Button>
</SeniorIconTooltip>
```

**Step 3: Wrap the Plus button in dokumente/page.tsx**

Find the Plus button block (lines ~325-336):
```tsx
<Button
  size="icon"
  variant="ghost"
  className="h-11 w-11 rounded-full text-warmgray-300 hover:text-sage-600 hover:bg-sage-50 transition-colors senior-mode:h-14 senior-mode:w-14"
  onClick={(event) => {
    event.stopPropagation();
    onAddDocument(categoryKey);
  }}
  title="Dokument hinzufügen"
>
  <Plus className="w-6 h-6" />
</Button>
```

Replace with:
```tsx
<SeniorIconTooltip label="Dokument hinzufügen">
  <Button
    size="icon"
    variant="ghost"
    className="h-11 w-11 rounded-full text-warmgray-300 hover:text-sage-600 hover:bg-sage-50 transition-colors senior-mode:h-14 senior-mode:w-14"
    onClick={(event) => {
      event.stopPropagation();
      onAddDocument(categoryKey);
    }}
    title="Dokument hinzufügen"
  >
    <Plus className="w-6 h-6" />
  </Button>
</SeniorIconTooltip>
```

**Step 4: Add import at the top of dokumente/page.tsx**

After the existing imports, add:
```tsx
import { SeniorIconTooltip } from '@/components/ui/senior-icon-tooltip'
```

**Step 5: Test in browser**

1. Enable senior mode
2. Navigate to `/dokumente`
3. Click Shield icon → tooltip "Sicherheit aktivieren" appears
4. Click again within 1.5 s → original action fires
5. Wait 1.5 s without second click → tooltip disappears automatically

**Step 6: Commit**

```bash
git add src/components/ui/senior-icon-tooltip.tsx src/app/(dashboard)/dokumente/page.tsx
git commit -m "feat(senior-mode): add tap-reveal label tooltip for icon-only buttons"
```

---

## Task 6: Senior mode navigation improvements

**Files:**
- Modify: `src/components/layout/dashboard-nav.tsx`
- Modify: `src/app/globals.css`

**Step 1: Increase nav item prominence in senior mode (CSS)**

Add to `globals.css` senior mode block:

```css
/* Senior Mode: Nav items — taller, bolder, more spaced */
.senior-mode nav a,
.senior-mode nav [role="link"] {
  padding-top: 1rem;
  padding-bottom: 1rem;
  font-size: 1.2rem;
  font-weight: 500;
  border-radius: 0.75rem;
}

/* Senior Mode: Section label above accessibility controls */
.senior-mode .senior-mode-toggle-label::before {
  content: "Barrierefreiheit";
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #8a827a;
  margin-bottom: 0.5rem;
}
```

**Step 2: Add section label to nav accessibility area**

In `dashboard-nav.tsx`, find the accessibility controls div (lines ~295-355):
```tsx
{/* Accessibility Controls - now part of scrollable area */}
<div className="mt-6 pt-6 border-t border-warmgray-200 space-y-4">
```

Replace with:
```tsx
{/* Accessibility Controls */}
<div className="mt-6 pt-6 border-t border-warmgray-200 space-y-4 senior-mode-toggle-label">
```

This adds the `senior-mode-toggle-label` class which triggers the CSS `::before` pseudo-element section label.

**Step 3: Make the "Einfache Ansicht" toggle more obvious in senior mode**

In `dashboard-nav.tsx`, find the toggle button (line ~296):
```tsx
<button
  onClick={() => setSeniorMode(!seniorMode)}
  className={cn(
    "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors",
    ...
  )}
  title="Größere Schrift und Bedienelemente"
>
```

Add the senior mode active state description:
```tsx
<button
  onClick={() => setSeniorMode(!seniorMode)}
  className={cn(
    "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors",
    seniorMode
      ? "bg-sage-100 text-sage-700 dark:bg-sage-900/30 dark:text-sage-400"
      : "bg-warmgray-50 text-warmgray-600 hover:bg-warmgray-100 dark:bg-warmgray-800 dark:text-warmgray-400 dark:hover:bg-warmgray-700"
  )}
  title="Größere Schrift und Bedienelemente"
>
  <Eye className={cn("w-5 h-5", seniorMode ? "text-sage-600 dark:text-sage-400" : "text-warmgray-400")} />
  <span className="flex-1 text-left">
    Einfache Ansicht
    {seniorMode && (
      <span className="block text-xs text-sage-600 font-normal">Aktiv — größere Schrift</span>
    )}
  </span>
  ...
```

**Step 4: Commit**

```bash
git add src/components/layout/dashboard-nav.tsx src/app/globals.css
git commit -m "feat(senior-mode): improve nav item sizing, section labels, and toggle visibility"
```

---

## Task 7: Contextual hints for senior mode

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/(dashboard)/dokumente/page.tsx` (add hint text in senior mode)

Senior users benefit from inline contextual explanations. These should only appear in senior mode.

**Step 1: Add a reusable senior mode hint CSS class**

Add to `globals.css` senior mode block:
```css
/* Senior Mode: Contextual hint text - shown only in senior mode */
.senior-hint {
  display: none;
}

.senior-mode .senior-hint {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  background-color: #f6f7f6;  /* sage-50 */
  border: 1px solid #c7d0c7;  /* sage-200 */
  border-radius: 0.625rem;
  font-size: 0.9375rem;
  color: #404b40;  /* sage-700 */
  line-height: 1.6;
  margin-top: 0.75rem;
}
```

**Step 2: Add page-level hint on the Dokumente page**

In `src/app/(dashboard)/dokumente/page.tsx`, find the main documents page header section (search for `<main` or the first `<div` with a heading "Dokumente"). Add a hint block immediately after:

```tsx
{/* Senior mode contextual hint — hidden in normal mode, visible in senior mode */}
<div className="senior-hint" role="note" aria-label="Hilfetext">
  <span className="text-lg">ℹ️</span>
  <span>
    Hier verwalten Sie Ihre wichtigen Dokumente. Klicken Sie auf eine Kategorie,
    um Dokumente hinzuzufügen oder zu sehen.
  </span>
</div>
```

**Step 3: Commit**

```bash
git add src/app/globals.css src/app/(dashboard)/dokumente/page.tsx
git commit -m "feat(senior-mode): add senior-hint CSS utility and contextual hint on dokumente page"
```

---

## Task 8: Smoke test and visual QA checklist

**No file changes.** Run through this checklist manually after all tasks complete.

**Setup:**
1. Start dev server: `npx next dev`
2. Log in as a test user
3. Enable senior mode via "Einfache Ansicht" toggle in the sidebar

**Checklist — senior mode ON:**

| Area | Check | Expected |
|---|---|---|
| `/dokumente` | Shield icon visible | Yes — circular button, icon centered |
| `/dokumente` | Plus icon visible | Yes — circular button, icon centered |
| `/dokumente` | Tap Shield once | Tooltip "Sicherheit aktivieren" appears above button |
| `/dokumente` | Tap Plus once | Tooltip "Dokument hinzufügen" appears above button |
| `/dokumente` | Category grid | Single column (one card per row) |
| `/dokumente` | Badge text (e.g. "Gesichert") | At least 15px — readable |
| Nav | "Einfache Ansicht" toggle | Shows "Aktiv — größere Schrift" subtitle when on |
| Nav | Nav link items | Taller, bolder than normal mode |
| Nav | Active nav item | Bold, left border visible |
| Any page | Inline `<a>` links in paragraphs | NOT forced to 60px height |
| Any page | Input focus ring | 3px ring, 4px offset — visible |
| Any page | Low contrast text (`text-warmgray-400`) | Boosted to warmgray-700 equivalent |
| Tailwind build | `senior-mode:text-xl` etc. | Active — elements visually larger |

**Checklist — senior mode OFF:**

| Area | Check | Expected |
|---|---|---|
| `/dokumente` | Shield + Plus buttons | Normal compact 44px circular size |
| Any page | Inline links | Normal flow, no min-height |
| Any page | Hint boxes | Hidden (`display: none`) |
| Any page | Grid layouts | Multi-column as designed |

---

## Summary of all changes

| File | Changes |
|---|---|
| `tailwind.config.ts` | Register `senior-mode` variant (activates 136 dead classes) |
| `src/app/globals.css` | Fix icon button bug, fix link min-height, add redesign rules |
| `src/components/ui/button.tsx` | Add `data-icon-button` attribute to icon-only buttons |
| `src/components/ui/senior-icon-tooltip.tsx` | New — tap-reveal tooltip wrapper |
| `src/app/(dashboard)/dokumente/page.tsx` | Wrap Shield/Plus with `SeniorIconTooltip`, add hint |
| `src/components/layout/dashboard-nav.tsx` | Toggle visibility, section label, active state hint |
