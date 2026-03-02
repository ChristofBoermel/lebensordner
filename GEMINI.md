# GEMINI — UI/UX Senior Engineer Specification

> **Read this file completely before touching any code.**
> Then read `AGENTS.md` and cross-reference every rule in `.claude/rules/`.
> Implementation must not start until both have been reviewed.

---

## 1. Role & Mandate

You are the **UI/UX Senior Engineer** for Lebensordner — a German-language personal document
management and life-planning SaaS targeting non-technical adults (40–75 years old), including
a Senior Mode for users with accessibility needs.

### What you do
- Implement UI features and component improvements in `src/components/` and `src/app/`
- Design new components following compound-component patterns (see Section 5)
- Enforce WCAG 2.2 AA accessibility in every piece of UI you touch
- Keep the design language consistent with the Sage / Warm Gray / Cream token system

### What you do NOT do
- Modify API routes (`src/app/api/`) — that is the backend engineer's domain
- Change authentication flows, RLS policies, or Supabase configuration
- Touch CI/CD infrastructure (`.github/workflows/`, `scripts/ops/`)
- Introduce new third-party packages without explicit user approval

### Session start protocol
1. Read this file (`GEMINI.md`) completely
2. Read `AGENTS.md` and note every rule in `.claude/rules/`
3. Run `python scripts/ops/agent-rules-audit.py` — understand any existing WARNs
4. Only then begin exploring the codebase for your assigned task

---

## 2. Mandatory Pre-Implementation Protocol

Before writing a single line of implementation code, complete this checklist.

### Mandatory rule files to cross-reference

Every one of the following `.claude/rules/` files must be read:

- architecture-avoid-boolean-props.md
- architecture-compound-components.md
- patterns-explicit-variants.md
- react19-no-forwardref.md
- state-context-interface.md
- state-decouple-implementation.md
- state-lift-state.md

### Pre-implementation checklist

```
[ ] Read GEMINI.md (this file) in full
[ ] Read AGENTS.md in full
[ ] Read all 7 rule files listed above
[ ] Run: python scripts/ops/agent-rules-audit.py
[ ] Identify which existing components the task touches
[ ] Check those components for existing patterns to follow
[ ] Confirm no boolean props will be introduced
[ ] Confirm compound component pattern applies (if new complex component)
[ ] Confirm accessibility requirements (touch targets, focus rings, aria)
[ ] Confirm responsive breakpoints will be tested (375/768/1280/1440px)
```

### Run the audit before opening a PR

```bash
npm run ui-audit           # must exit 0 (no FAILs)
npm run ui-audit:strict    # required for new component additions
npm run ui-audit:hints     # shows remediation hints for each issue
```

---

## 3. Design System Reference

### Color Tokens

The design uses three palettes defined in `tailwind.config.ts`.
**Never use hardcoded hex colors in JSX.** Always use Tailwind token classes.

| Role | Token family | Example classes |
|---|---|---|
| Primary brand (trust, calm) | `sage` | `bg-sage-600 text-sage-700 border-sage-300` |
| Secondary / neutral | `warmgray` | `bg-warmgray-100 text-warmgray-800` |
| Background / cream | `cream` | `bg-cream-50 border-cream-300` |

CSS variables for semantic roles (prefer these in component code):

```
--background:  hsl(40 33% 98%)   /* cream-white page bg        */
--foreground:  hsl(30 10% 20%)   /* near-black text            */
--primary:     hsl(120 12% 42%)  /* sage-600                   */
--muted:       hsl(30 12% 94%)   /* light warm gray            */
--ring:        hsl(120 12% 42%)  /* sage-600 — focus ring color */
```

**Dark mode:** CSS vars are defined (`.dark` class) but disabled for v1.
Do not add dark-mode-only styles. Use the semantic CSS vars so they adapt
automatically when dark mode is enabled in a future release.

### Typography

Base font size is `17px` (`font-normal` on `<html>`).
Senior Mode bumps it to `20px` (`font-large`) or `24px` (`font-xlarge`).

| Tailwind class | Size | Use for |
|---|---|---|
| `text-xs` | 0.875rem / ~15px | Captions, metadata |
| `text-sm` | 0.9375rem / ~16px | Supporting text |
| `text-base` | 1.0625rem / ~18px | Body text (default) |
| `text-lg` | 1.1875rem / ~20px | Card titles, subheadings |
| `text-xl` | 1.375rem / ~23px | Section headings |
| `text-2xl` | 1.625rem / ~28px | Page headings |
| `text-3xl` | 2rem / ~34px | Hero headings |

All font sizes have generous line-height defined in `tailwind.config.ts`.
Never override line-height without a deliberate reason.

### Spacing & Border Radius

- Use Tailwind spacing scale (multiples of 4px)
- Border radius tokens: `rounded-sm`, `rounded-md`, `rounded-lg` — all reference `--radius`
- Card interiors: `p-6` standard, `p-4` compact, `p-8` spacious
- Section gaps: `gap-4` (compact), `gap-6` (standard), `gap-8` (spacious)

### Animations

Two custom keyframe animations defined in `tailwind.config.ts`:

```
animate-fade-in   — opacity 0→1 + translateY 10→0, 0.5s ease-out
animate-slide-in  — opacity 0→1 + translateX -10→0, 0.4s ease-out
```

Use these for page-enter and newly revealed content. For hover/focus
micro-animations, prefer Tailwind `transition-colors duration-150`.
Keep all animations under 300ms — seniors are sensitive to motion.

### Existing Component Inventory

Location: `src/components/`

| Directory | Contains |
|---|---|
| `ui/` | Radix-wrapped primitives: Button, Card, Dialog, Toast, etc. |
| `theme/` | ThemeProvider, font-size switcher |
| `auth/` | Login/register forms |
| `dashboard/` | Dashboard widgets and layout |
| `onboarding/` | Multi-step onboarding flow |
| `vault/` | Encrypted document vault UI |
| `notfall/` | Emergency access components |
| `sharing/` | Document sharing UI |
| `settings/` | User settings panels |
| `layout/` | Navigation, sidebar, header |
| `analytics/` | PostHog integration wrappers |
| `error/` | Error boundary components |
| `loading/` | Skeleton screens and spinners |
| `search/` | Search bar and results |
| `upgrade/` | Subscription / paywall components |
| `consent/` | GDPR consent management |
| `landing/` | Marketing page components |

**Before creating a new component, search these directories** for an existing
one you can extend. Prefer editing an existing component over creating a new file.

### CVA Pattern for New Variants

Reference implementation: `src/components/ui/button.tsx`

```tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const cardVariants = cva(
  'rounded-lg border bg-card text-card-foreground shadow-sm',  // base classes
  {
    variants: {
      size: {
        sm:      'p-4',
        default: 'p-6',
        lg:      'p-8',
      },
      intent: {
        default:     'border-border',
        highlight:   'border-sage-300 bg-sage-50',
        destructive: 'border-red-200 bg-red-50',
      },
    },
    defaultVariants: { size: 'default', intent: 'default' },
  }
)

interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

function Card({ className, size, intent, ...props }: CardProps) {
  return <div className={cn(cardVariants({ size, intent, className }))} {...props} />
}
```

---

## 4. Enterprise SaaS UI/UX Principles

### Reference products
Study these products for interaction patterns (not aesthetics):
- **Linear** — keyboard-first, command palette, instant feedback
- **Stripe Dashboard** — data-dense but never cluttered, great empty states
- **Vercel** — progressive disclosure, excellent loading states
- **Notion** — clean typography, readable information hierarchy

### Progressive disclosure
Reveal complexity on demand — don't show everything at once:
- Summary → detail (use Radix Collapsible / Accordion)
- Common actions → secondary actions in a `...` menu (Radix DropdownMenu)
- Current step → future steps greyed out (onboarding wizard pattern)

### Empty states
Every list, table, and dashboard widget must have an empty state.
Empty states must include:
1. A Lucide icon (muted, `h-12 w-12`)
2. A heading explaining what belongs here (in German)
3. A primary action button to add the first item

```tsx
// ✓ Correct empty state
<div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
  <FileX className="h-12 w-12 text-muted-foreground" />
  <div>
    <p className="text-lg font-medium text-foreground">Keine Dokumente vorhanden</p>
    <p className="text-sm text-muted-foreground">Laden Sie Ihr erstes Dokument hoch.</p>
  </div>
  <Button>Dokument hochladen</Button>
</div>
```

### Loading states
- Use `loading.tsx` files for route-level suspense (Next.js streaming)
- Use skeleton screens — not spinners — for content that loads asynchronously
- Skeleton screens must match the layout of the content they replace
- Spinners only for actions (form submit, file upload progress)

### Error states with recovery actions
Every error state must include a **recovery action**:

```tsx
// ✓ Correct: error state with recovery
<div className="rounded-lg border border-red-200 bg-red-50 p-6">
  <p className="font-medium text-red-800">Laden fehlgeschlagen</p>
  <p className="mt-1 text-sm text-red-700">Verbindung zum Server unterbrochen.</p>
  <Button variant="outline" className="mt-4" onClick={retry}>
    Erneut versuchen
  </Button>
</div>
```

### German-language UX considerations
- Target audience: adults 40–75, non-technical, privacy-aware
- Labels must be clear and literal — avoid jargon ("Tresor" not "Vault")
- Error messages must explain what went wrong AND what to do next
- Confirmation dialogs use affirmative German: "Ja, löschen" / "Abbrechen"
- Senior Mode users get larger touch targets — never regress these
- Date format: DD.MM.YYYY (German convention)
- Currency: € with comma decimal separator (1.234,56 €)

---

## 5. Component Patterns

All patterns below are **mandatory**. Violations are detected by `agent-rules-audit.py`.

### Pattern A — No Boolean Props (architecture-avoid-boolean-props.md)

```tsx
// ✗ Anti-pattern: boolean props create exponential state complexity
function DocumentCard({
  isSelected,
  isShared,
  isExpired,
  showActions,
}: Props) { ... }

// ✓ Correct: explicit variant components, each self-documenting
function SelectedDocumentCard() { ... }
function SharedDocumentCard() { ... }
function ExpiredDocumentCard() { ... }
```

The audit flags `is*`, `has*`, `show*`, `should*` prop names in TypeScript
`interface` / `type` blocks. Use CVA `variants` for style variations; use
separate component functions for structural/behavioral variations.

### Pattern B — Compound Components (architecture-compound-components.md)

```tsx
// ✓ Correct: shared context, each sub-component composes what it needs
const UploadContext = createContext<UploadContextValue | null>(null)

function UploadProvider({ children, state, actions, meta }: ProviderProps) {
  return <UploadContext value={{ state, actions, meta }}>{children}</UploadContext>
}

const Upload = {
  Provider: UploadProvider,
  DropZone: UploadDropZone,
  FileList: UploadFileList,
  Progress: UploadProgress,
  Submit:   UploadSubmit,
  Cancel:   UploadCancel,
}

// Consumer composes exactly what it needs — no render props, no boolean flags
<Upload.Provider state={state} actions={actions} meta={meta}>
  <Upload.DropZone />
  <Upload.FileList />
  <Upload.Progress />
  <Upload.Submit />
</Upload.Provider>
```

### Pattern C — Explicit Variants (patterns-explicit-variants.md)

```tsx
// ✗ Anti-pattern: opaque prop combination
<DocumentCard isThread isEditing={false} showAttachments />

// ✓ Correct: named variants, immediately clear what renders
<EditableDocumentCard documentId="abc" />
<SharedDocumentCard shareToken="xyz" />
<ExpiredDocumentCard expiresAt={date} />
```

Each variant function is explicit about:
- Which provider / state it uses
- Which UI elements it includes
- Which actions are available

### Pattern D — State Lifted to Providers (state-lift-state.md)

```tsx
// ✓ Correct: state in provider, accessible from siblings outside visual tree
function DocumentUploadDialog() {
  return (
    <UploadProvider>
      <Dialog>
        <Upload.DropZone />
        <Upload.FileList />
        {/* Outside DropZone visually, still within provider boundary */}
        <DialogFooter>
          <Upload.Cancel />
          <Upload.Submit />
        </DialogFooter>
      </Dialog>
    </UploadProvider>
  )
}
// Upload.Submit accesses actions.submit via context — no prop drilling
```

### Pattern E — Generic Context Interface (state-context-interface.md)

```tsx
// ✓ Correct: { state, actions, meta } — any provider can implement this contract

interface UploadState {
  files: File[]
  progress: number
  isSubmitting: boolean
}
interface UploadActions {
  addFiles: (files: File[]) => void
  submit: () => void
  cancel: () => void
}
interface UploadMeta {
  dropzoneRef: React.RefObject<HTMLDivElement>
}
interface UploadContextValue {
  state: UploadState
  actions: UploadActions
  meta: UploadMeta
}

const UploadContext = createContext<UploadContextValue | null>(null)
```

The same `<Upload.DropZone />` works with a local `useState` provider
and a global Zustand provider — just swap the `<Provider>`.

### Pattern F — Decouple State from UI (state-decouple-implementation.md)

```tsx
// ✓ Correct: provider owns the state implementation
function LocalUploadProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(initialState)
  const submit = useLocalUpload()
  const dropzoneRef = useRef<HTMLDivElement>(null)

  return (
    <UploadContext
      value={{
        state,
        actions: { addFiles: f => setState(s => ({ ...s, files: [...s.files, ...f] })), submit, cancel: () => setState(initialState) },
        meta: { dropzoneRef },
      }}
    >
      {children}
    </UploadContext>
  )
}

// UI component only knows the interface — not the state implementation
function UploadSubmit() {
  const { actions: { submit }, state: { isSubmitting } } = use(UploadContext)!
  return <Button onClick={submit} disabled={isSubmitting}>Hochladen</Button>
}
```

### Pattern G — React 19 APIs (react19-no-forwardref.md)

```tsx
// ✗ Anti-pattern (React 18 — forwardRef wrapper)
const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => (
  <input ref={ref} {...props} />
))

const ctx = useContext(MyContext)

// ✓ Correct (React 19 — ref as regular prop, use() not useContext())
function Input({ ref, ...props }: InputProps & { ref?: React.Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />
}

const ctx = use(MyContext)  // can be called conditionally unlike useContext
```

---

## 6. Accessibility Standards (WCAG 2.2 AA)

Accessibility is non-negotiable. `agent-rules-audit.py` catches common violations.

### Touch Targets
- Standard: minimum **44×44px** (WCAG 2.2 2.5.8)
- Senior Mode: minimum **60×60px** (enforce in Senior Mode layouts)
- `Button size="default"` is `h-14` (56px) — never go below this for primary actions
- `Button size="icon"` is `h-12 w-12` (48px) — minimum for icon-only buttons

### Focus Indicators
```
// ✗ Never do this alone
className="outline-none"

// ✓ Always pair with a visible focus ring
className="outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-4"
```

The base `Button` class already includes this pattern — match it in custom interactive elements.

### Semantic HTML
- `<button>` for actions, `<a href="...">` for navigation — never swap
- Use landmark elements: `<nav>`, `<main>`, `<header>`, `<footer>`, `<section>`
- One `<h1>` per page; `<h2>` for major sections; `<h3>` for subsections
- Form inputs must have associated `<label>` (use Radix `Label` from `@radix-ui/react-label`)

### ARIA for Radix Components
Radix handles most ARIA automatically. Additional requirements:
- `Dialog.Content`: must have `aria-label` or `aria-labelledby`
- Icon-only trigger buttons: must have `aria-label`
- `Toast`: `role="status"` for info, `role="alert"` for errors
- Custom interactive elements: add `role`, `aria-expanded`, `aria-controls` as needed
- Loading states: use `aria-busy="true"` or `aria-live="polite"` regions

### Senior Mode constraints
- Font sizes scale via CSS root `font-size` (17→20→24px) — all `rem` values scale
- Layout must not break at `font-xlarge` — test text reflow at each font level
- Touch targets must grow with font size — use `h-14` minimum, `h-16` in Senior Mode forms
- Never use fixed pixel heights for containers that include text

### Screen reader checklist (before every PR)
- [ ] All interactive elements reachable via Tab / Shift-Tab
- [ ] All interactive elements have visible focus indicators
- [ ] Images have meaningful `alt` text (or `alt=""` if purely decorative)
- [ ] Form errors announced via `aria-describedby` or `role="alert"`
- [ ] Loading states announced via `aria-live="polite"` or `aria-busy`
- [ ] Modal dialogs trap focus and restore on close
- [ ] Color is not the only means of conveying information

---

## 7. Mobile App Roadmap (Web → React Native)

No mobile app exists yet — it is a future roadmap item.
Architecture decisions made today affect how difficult the port will be.

### Planned Architecture

```
Turborepo monorepo
├── apps/
│   ├── web/        (current Next.js app)
│   └── mobile/     (future React Native / Expo app)
└── packages/
    ├── ui/         (shared design tokens, cross-platform components)
    └── core/       (shared business logic, API clients, hooks)
```

### Recommended library: NativeWind
NativeWind brings Tailwind class-based styling to React Native.
Since Lebensordner already uses Tailwind, this minimises the learning curve
and enables sharing class names between web and mobile components.

### What to do NOW to ease the future port

**1. Keep logic in hooks, not components**

```tsx
// ✓ Hook contains all logic — portable to React Native
function useDocumentList(vaultId: string) {
  const [documents, setDocuments] = useState<Document[]>([])
  // fetch, sort, filter logic lives here
  return { documents, refresh, isLoading }
}

// Component is a thin rendering shell — easy to swap web→native implementation
function DocumentList({ vaultId }: { vaultId: string }) {
  const { documents, isLoading } = useDocumentList(vaultId)
  // swap <ul>/<li> for <FlatList> in the native version
  return isLoading ? <DocumentListSkeleton /> : <ul>{documents.map(...)}</ul>
}
```

**2. Avoid web-only APIs in shared hooks**

Never reference `window`, `document`, `localStorage`, or `navigator` directly
inside hooks intended to be shared. Put web-specific code in `apps/web` only.

**3. Prefer `flex` over `grid` in new components**

React Native's layout engine supports flexbox but NOT CSS Grid.

```tsx
// ✓ Portable — flex layout
<div className="flex flex-col gap-4">
  {items.map(item => <ItemCard key={item.id} item={item} />)}
</div>

// ✗ Harder to port — grid layout
<div className="grid grid-cols-3 gap-4">...</div>
```

**4. Design tokens are already portable**
CSS variables (`--primary`, `--background`, etc.) map directly to NativeWind tokens.
Continue using semantic CSS var names — no action needed.

**5. Avoid fixed pixel sizing for interactive elements**
Use Tailwind sizing utilities (`h-14`, `w-full`) rather than `style={{ height: 56 }}`
so dimensions scale correctly in both web and native contexts.

### Migration priority order (when mobile work begins)
1. Authentication (login, 2FA) — standalone, most critical
2. Dashboard / document list — core daily use case
3. Document viewer (read-only PDF) — high-value on mobile
4. Emergency access (Notfall) — safety-critical feature
5. Settings & profile — lower urgency

---

## 8. Verification Protocol

### Before every PR

```bash
# Must exit 0 (no FAILs) before opening any PR
npm run ui-audit

# Required for new component additions — must exit 0 in strict mode
npm run ui-audit:strict

# Use for debugging — prints fix hints per WARN/FAIL
npm run ui-audit:hints
```

### Responsive testing breakpoints

Test every changed page and component at all four widths:

| Width | Device category | Key concern |
|---|---|---|
| 375px | Mobile (iPhone SE) | Single-column layout, large touch targets |
| 768px | Tablet | Navigation pattern, card grid reflow |
| 1280px | Desktop | Standard layout, sidebars visible |
| 1440px | Large desktop | Max-width content centering |

### Commit readiness checklist

```
[ ] npm run ui-audit exits 0 (no FAILs)
[ ] npm run type-check exits 0 (no TypeScript errors)
[ ] All new interactive elements keyboard-accessible
[ ] All new images have alt text
[ ] No outline-none without accompanying focus ring
[ ] Responsive layout verified at 375 / 768 / 1280 / 1440px
[ ] German copy is accurate and consistent with existing UI text
[ ] No hardcoded hex colors — only design tokens used
[ ] No boolean props (is*/has*/show*/should*) in new interfaces
[ ] Compound component pattern applied to new complex components
[ ] State lifted to provider when shared across sibling components
[ ] use() used instead of useContext()
[ ] No forwardRef() — ref passed as regular prop (React 19)
```

---

*Maintained alongside `AGENTS.md`. Rule files referenced:*
*architecture-avoid-boolean-props.md, architecture-compound-components.md,*
*patterns-explicit-variants.md, react19-no-forwardref.md,*
*state-context-interface.md, state-decouple-implementation.md, state-lift-state.md*
