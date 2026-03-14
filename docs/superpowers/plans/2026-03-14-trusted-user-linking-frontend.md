# Trusted User Linking Frontend Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the trusted-user linking experience to use an explicit, stateful lifecycle flow for both owner and trusted user, aligned to the backend relationship_status state machine shipped on 2026-03-13.

**Architecture:** New compound components (`TrustedPersonStatusCard`, `SetupLinkPanel`, `TrustedUserStatusView`) handle each user's perspective independently. The owner side replaces generic trusted person card rows with lifecycle-aware status cards. The trusted user side adds a dedicated "Mein Zugriff" tab (alongside existing Familie/Vertrauenspersonen tabs). All state is driven from backend `relationship_status` — no frontend-only state machine.

**Tech Stack:** Next.js 15, React 19 (ref as prop, `use()` for context), TypeScript, Tailwind CSS, shadcn/ui, Vitest + Testing Library

**Spec reference:** `docs/temp-trusted-user-linking-frontend-tech-plan.md`

---

## Chunk 1: Types, Share Filter, and Owner-Side Components

### Task 1: Verify and update TrustedPerson TypeScript type

**Files:**
- Modify: `src/types/database.ts` (trusted_persons Row section)

- [ ] **Step 1: Check if `relationship_status` is present in the type**

Open `src/types/database.ts` and search for the `trusted_persons` Row definition (around line 415). Confirm whether `relationship_status` and `invitation_expires_at` fields are present.

- [ ] **Step 2: Add missing fields if absent**

If `relationship_status` is absent from `trusted_persons.Row`, add it. Find the `trusted_persons` Row block and add:

```typescript
relationship_status: 'invited' | 'accepted_pending_setup' | 'setup_link_sent' | 'active' | 'revoked'
invitation_expires_at: string | null
```

The block already has `invitation_status`, `is_active`, `linked_user_id`. Add the two new fields to the `Row`, `Insert`, and `Update` blocks:

```typescript
// In Row block:
relationship_status: 'invited' | 'accepted_pending_setup' | 'setup_link_sent' | 'active' | 'revoked'
invitation_expires_at: string | null

// In Insert block:
relationship_status?: 'invited' | 'accepted_pending_setup' | 'setup_link_sent' | 'active' | 'revoked' | null
invitation_expires_at?: string | null

// In Update block:
relationship_status?: 'invited' | 'accepted_pending_setup' | 'setup_link_sent' | 'active' | 'revoked' | null
invitation_expires_at?: string | null
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
cd "D:/Projects/Lebensordner" && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors related to `relationship_status`.

- [ ] **Step 4: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: add relationship_status and invitation_expires_at to TrustedPerson type"
```

---

### Task 2: Update share-eligible filter to require `active` relationship

**Files:**
- Modify: `src/lib/trusted-persons/share-eligible.ts`
- Test: `tests/lib/` (new file)

- [ ] **Step 1: Write a failing test for the new filter behavior**

Create `tests/lib/share-eligible.test.ts`.

Note: declare `mockChain` **before** `mockSupabase` so the `from` factory captures the correct reference.
The test will fail on the current code because all three rows have non-null `linked_user_id`, so the existing filter returns 3 rows — not 1. Adding `eq('relationship_status', 'active')` will make the DB-level mock only return active rows.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('loadShareEligibleTrustedPersons', () => {
  beforeEach(() => {
    // Constructor-time fn per MEMORY.md: survives vi.restoreAllMocks()
    global.fetch = vi.fn(() => Promise.resolve({ ok: true })) as any
    vi.resetModules()
  })

  it('only returns persons with relationship_status active', async () => {
    const allRows = [
      { id: 'tp-1', name: 'Alice', email: 'alice@example.com', linked_user_id: 'user-1', relationship_status: 'active' },
      { id: 'tp-2', name: 'Bob',   email: 'bob@example.com',   linked_user_id: 'user-2', relationship_status: 'accepted_pending_setup' },
      { id: 'tp-3', name: 'Carol', email: 'carol@example.com', linked_user_id: 'user-3', relationship_status: 'setup_link_sent' },
    ]

    // Build chain — declared first so mockSupabase.from can reference it safely.
    // `eq` captures the relationship_status filter arg; `order` simulates the DB
    // filter so the red/green cycle is meaningful (no filter → 3 rows; filter applied → 1 row).
    let capturedRelStatusFilter: string | null = null
    const mockChain: Record<string, unknown> = {}
    mockChain.select = () => mockChain
    mockChain.eq    = (_field: string, value: unknown) => {
      if (_field === 'relationship_status') capturedRelStatusFilter = value as string
      return mockChain
    }
    mockChain.not   = () => mockChain
    mockChain.order = () => {
      const filtered = capturedRelStatusFilter
        ? allRows.filter(r => r.relationship_status === capturedRelStatusFilter)
        : allRows
      return Promise.resolve({ data: filtered, error: null })
    }

    const mockSupabase = {
      auth: { getUser: async () => ({ data: { user: { id: 'owner-1' } } }) },
      from: () => mockChain,
    }

    const { loadShareEligibleTrustedPersons } = await import('@/lib/trusted-persons/share-eligible')
    const result = await loadShareEligibleTrustedPersons(mockSupabase as any)

    // Before fix: capturedRelStatusFilter is null → 3 rows returned → toHaveLength(1) FAILS
    // After fix: capturedRelStatusFilter is 'active' → 1 row returned → PASSES
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('tp-1')
    expect(result[0].name).toBe('Alice')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "D:/Projects/Lebensordner" && npx vitest run tests/lib/share-eligible.test.ts 2>&1
```

Expected: FAIL — `expect(received).toHaveLength(1)` received length 3 (all rows pass without the filter).

- [ ] **Step 3: Add `relationship_status` to the query and filter**

Edit `src/lib/trusted-persons/share-eligible.ts`:

Change the select call from:
```typescript
.select('id, name, email, linked_user_id')
.eq('user_id', user.id)
.eq('invitation_status', 'accepted')
.eq('is_active', true)
.not('linked_user_id', 'is', null)
```

To:
```typescript
.select('id, name, email, linked_user_id, relationship_status')
.eq('user_id', user.id)
.eq('invitation_status', 'accepted')
.eq('is_active', true)
.eq('relationship_status', 'active')
.not('linked_user_id', 'is', null)
```

Also update the `TrustedPersonRecipientRow` type alias:
```typescript
type TrustedPersonRecipientRow = Pick<
  Database['public']['Tables']['trusted_persons']['Row'],
  'id' | 'name' | 'email' | 'linked_user_id' | 'relationship_status'
>
```

Remove the client-side `filter` at the end — the DB query now handles it.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "D:/Projects/Lebensordner" && npx vitest run tests/lib/share-eligible.test.ts 2>&1
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/trusted-persons/share-eligible.ts tests/lib/share-eligible.test.ts
git commit -m "feat: require relationship_status=active for share-eligible trusted persons"
```

---

### Task 3: Create `TrustedPersonStatusCard` component

This is the core owner-side component. Shows the 5-step lifecycle checklist and a state-driven CTA for each trusted person.

**Files:**
- Create: `src/components/trusted-access/TrustedPersonStatusCard.tsx`
- Test: `tests/components/trusted-access-status-card.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/components/trusted-access-status-card.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TrustedPersonStatusCard } from '@/components/trusted-access/TrustedPersonStatusCard'

const basePerson = {
  id: 'tp-1',
  name: 'Anna Müller',
  email: 'anna@example.com',
  relationship: 'Tochter',
  relationship_status: 'invited' as const,
  invitation_status: 'sent',
  is_active: true,
  linked_user_id: null,
  phone: null,
  notes: null,
  // other required fields can be empty strings / nulls
  user_id: 'owner-1',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  access_level: 'immediate',
  access_delay_hours: 0,
  invitation_sent_at: null,
  invitation_expires_at: null,
  invitation_accepted_at: null,
  email_status: 'sent',
}

describe('TrustedPersonStatusCard', () => {
  it('shows "Auf Annahme warten" CTA for invited status', () => {
    render(
      <TrustedPersonStatusCard
        person={{ ...basePerson, relationship_status: 'invited' }}
        isGeneratingSetupLink={false}
        onCreateSetupLink={vi.fn()}
        onSendInvite={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleActive={vi.fn()}
      />
    )
    expect(screen.getByText('Auf Annahme warten')).toBeInTheDocument()
  })

  it('shows "Sicheren Link erstellen" CTA for accepted_pending_setup status', () => {
    render(
      <TrustedPersonStatusCard
        person={{ ...basePerson, relationship_status: 'accepted_pending_setup', linked_user_id: 'user-2' }}
        isGeneratingSetupLink={false}
        onCreateSetupLink={vi.fn()}
        onSendInvite={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleActive={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /sicheren link erstellen/i })).toBeInTheDocument()
  })

  it('shows "Neuen Link senden" CTA for setup_link_sent status', () => {
    render(
      <TrustedPersonStatusCard
        person={{ ...basePerson, relationship_status: 'setup_link_sent', linked_user_id: 'user-2' }}
        isGeneratingSetupLink={false}
        onCreateSetupLink={vi.fn()}
        onSendInvite={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleActive={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /neuen link senden/i })).toBeInTheDocument()
  })

  it('shows "Dokumente freigeben" CTA for active status', () => {
    render(
      <TrustedPersonStatusCard
        person={{ ...basePerson, relationship_status: 'active', linked_user_id: 'user-2' }}
        isGeneratingSetupLink={false}
        onCreateSetupLink={vi.fn()}
        onSendInvite={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleActive={vi.fn()}
      />
    )
    expect(screen.getByText('Dokumente freigeben')).toBeInTheDocument()
  })

  it('calls onCreateSetupLink when setup link button is clicked', async () => {
    const user = userEvent.setup()
    const onCreateSetupLink = vi.fn()
    render(
      <TrustedPersonStatusCard
        person={{ ...basePerson, relationship_status: 'accepted_pending_setup', linked_user_id: 'user-2' }}
        isGeneratingSetupLink={false}
        onCreateSetupLink={onCreateSetupLink}
        onSendInvite={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleActive={vi.fn()}
      />
    )
    await user.click(screen.getByRole('button', { name: /sicheren link erstellen/i }))
    expect(onCreateSetupLink).toHaveBeenCalledWith(expect.objectContaining({ id: 'tp-1' }))
  })

  it('shows the 5-step lifecycle checklist', () => {
    render(
      <TrustedPersonStatusCard
        person={{ ...basePerson, relationship_status: 'invited' }}
        isGeneratingSetupLink={false}
        onCreateSetupLink={vi.fn()}
        onSendInvite={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleActive={vi.fn()}
      />
    )
    expect(screen.getByText('Einladung gesendet')).toBeInTheDocument()
    expect(screen.getByText('Einladung angenommen')).toBeInTheDocument()
    expect(screen.getByText('Sicheren Zugriff einrichten')).toBeInTheDocument()
    expect(screen.getByText('Dokumente freigeben')).toBeInTheDocument()
    expect(screen.getByText('Zugriff aktiv')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "D:/Projects/Lebensordner" && npx vitest run tests/components/trusted-access-status-card.test.tsx 2>&1
```

Expected: FAIL (file not found).

- [ ] **Step 3: Create the component**

Create `src/components/trusted-access/TrustedPersonStatusCard.tsx`:

```typescript
'use client'

import { CheckCircle2, Circle, Loader2, Key, Send, Shield, Edit2, Trash2, XCircle, Mail, Phone } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { TrustedPerson } from '@/types/database'
import type { TrustedAccessRelationshipStatus } from '@/lib/security/trusted-access'

const LIFECYCLE_STEPS = [
  'Einladung gesendet',
  'Einladung angenommen',
  'Sicheren Zugriff einrichten',
  'Dokumente freigeben',
  'Zugriff aktiv',
] as const

/**
 * Maps relationship_status to which step index (0-4) is currently active.
 * active + hasExplicitShares → step 4 (Zugriff aktiv)
 * active                    → step 3 (Dokumente freigeben — owner must share)
 */
function getCurrentStepIndex(
  status: TrustedAccessRelationshipStatus,
  hasExplicitShares: boolean
): number {
  switch (status) {
    case 'invited': return 0
    case 'accepted_pending_setup': return 1
    case 'setup_link_sent': return 2
    case 'active': return hasExplicitShares ? 4 : 3
    case 'revoked': return -1
    default: return 0
  }
}

function getStepState(
  stepIndex: number,
  currentStepIndex: number
): 'done' | 'current' | 'upcoming' {
  if (currentStepIndex < 0) return 'upcoming'
  if (stepIndex < currentStepIndex) return 'done'
  if (stepIndex === currentStepIndex) return 'current'
  return 'upcoming'
}

interface TrustedPersonStatusCardProps {
  person: TrustedPerson
  hasExplicitShares?: boolean
  isGeneratingSetupLink: boolean
  isSendingInvite?: boolean
  onCreateSetupLink: (person: TrustedPerson) => void
  onSendInvite: (personId: string) => void
  onEdit: (person: TrustedPerson) => void
  onDelete: (id: string) => void
  onToggleActive: (person: TrustedPerson) => void
}

export function TrustedPersonStatusCard({
  person,
  hasExplicitShares = false,
  isGeneratingSetupLink,
  isSendingInvite = false,
  onCreateSetupLink,
  onSendInvite,
  onEdit,
  onDelete,
  onToggleActive,
}: TrustedPersonStatusCardProps) {
  const status = (person.relationship_status ?? 'invited') as TrustedAccessRelationshipStatus
  const currentStepIndex = getCurrentStepIndex(status, hasExplicitShares)

  const borderColor =
    status === 'active' ? 'border-l-sage-500' :
    status === 'setup_link_sent' ? 'border-l-blue-400' :
    status === 'accepted_pending_setup' ? 'border-l-amber-400' :
    status === 'revoked' ? 'border-l-warmgray-300' :
    'border-l-warmgray-200'

  return (
    <Card
      data-testid={`trusted-person-card-${person.id}`}
      className={`border-l-4 ${borderColor}`}
    >
      <CardContent className="pt-5 pb-4">
        {/* Header row: name, email, actions */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Shield className="w-5 h-5 text-sage-600" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-warmgray-900 truncate">{person.name}</h3>
              <p className="text-sm text-warmgray-500">{person.relationship}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-warmgray-400 flex-wrap">
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {person.email}
                </span>
                {person.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {person.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" onClick={() => onEdit(person)} title="Bearbeiten" className="h-8 w-8">
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onToggleActive(person)} title="Deaktivieren" className="h-8 w-8">
              <XCircle className="w-3.5 h-3.5 text-warmgray-400" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(person.id)}
              title="Löschen"
              className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Lifecycle checklist */}
        <div className="flex items-center gap-0 mb-4 overflow-x-auto pb-1">
          {LIFECYCLE_STEPS.map((label, idx) => {
            const stepStatus = getStepState(idx, currentStepIndex)
            return (
              <div key={label} className="flex items-center">
                <div className="flex flex-col items-center min-w-[72px]">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    stepStatus === 'done' ? 'bg-sage-500 text-white' :
                    stepStatus === 'current' ? 'bg-sage-600 text-white ring-2 ring-sage-200' :
                    'bg-warmgray-100 text-warmgray-400'
                  }`}>
                    {stepStatus === 'done' ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Circle className="w-3 h-3" />
                    )}
                  </div>
                  <span className={`text-[10px] text-center mt-1 leading-tight px-0.5 ${
                    stepStatus === 'current' ? 'text-sage-700 font-medium' :
                    stepStatus === 'done' ? 'text-sage-600' :
                    'text-warmgray-400'
                  }`}>
                    {label}
                  </span>
                </div>
                {idx < LIFECYCLE_STEPS.length - 1 && (
                  <div className={`h-px w-4 flex-shrink-0 mb-3 ${
                    getStepState(idx + 1, currentStepIndex) !== 'upcoming' || stepStatus === 'done'
                      ? 'bg-sage-300' : 'bg-warmgray-200'
                  }`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Primary CTA row */}
        <div className="flex items-center gap-2 flex-wrap">
          {status === 'invited' && (
            <Button
              variant="outline"
              size="sm"
              disabled={isSendingInvite}
              onClick={() => onSendInvite(person.id)}
              className="text-warmgray-600"
            >
              {isSendingInvite ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
              {isSendingInvite ? 'Wird gesendet…' : 'Einladung erneut senden'}
            </Button>
          )}

          {status === 'invited' && (
            <span className="text-xs text-warmgray-400">Auf Annahme warten</span>
          )}

          {(status === 'accepted_pending_setup' || status === 'setup_link_sent') && (
            <Button
              size="sm"
              disabled={isGeneratingSetupLink}
              onClick={() => onCreateSetupLink(person)}
              className="bg-sage-600 hover:bg-sage-700 text-white"
            >
              {isGeneratingSetupLink ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Key className="w-3.5 h-3.5 mr-1.5" />
              )}
              {status === 'setup_link_sent' ? 'Neuen Link senden' : 'Sicheren Link erstellen'}
            </Button>
          )}

          {status === 'active' && (
            <span className="inline-flex items-center gap-1.5 text-xs text-sage-700 bg-sage-50 border border-sage-200 px-2 py-1 rounded-full font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Dokumente freigeben
            </span>
          )}

          {status === 'revoked' && (
            <span className="text-xs text-warmgray-400">Status: deaktiviert</span>
          )}
        </div>

        {person.notes && (
          <p className="text-xs text-warmgray-400 mt-2 italic">{person.notes}</p>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "D:/Projects/Lebensordner" && npx vitest run tests/components/trusted-access-status-card.test.tsx 2>&1
```

Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/trusted-access/TrustedPersonStatusCard.tsx tests/components/trusted-access-status-card.test.tsx
git commit -m "feat: add TrustedPersonStatusCard with lifecycle checklist and state-based CTAs"
```

---

### Task 4: Create `SetupLinkPanel` component

Shows post-copy instructions after owner creates/copies a setup link. Persistent (not toast-only).

**Files:**
- Create: `src/components/trusted-access/SetupLinkPanel.tsx`
- Test: `tests/components/setup-link-panel.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/setup-link-panel.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SetupLinkPanel } from '@/components/trusted-access/SetupLinkPanel'

describe('SetupLinkPanel', () => {
  const defaultProps = {
    recipientName: 'Anna Müller',
    recipientEmail: 'anna@example.com',
    setupUrl: 'https://example.com/setup?token=abc123',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    onDismiss: vi.fn(),
  }

  it('shows the recipient name and email', () => {
    render(<SetupLinkPanel {...defaultProps} />)
    expect(screen.getByText(/Anna Müller/)).toBeInTheDocument()
    expect(screen.getByText(/anna@example.com/)).toBeInTheDocument()
  })

  it('shows the setup link URL', () => {
    render(<SetupLinkPanel {...defaultProps} />)
    expect(screen.getByText('https://example.com/setup?token=abc123')).toBeInTheDocument()
  })

  it('shows expiry information', () => {
    render(<SetupLinkPanel {...defaultProps} />)
    expect(screen.getByText(/gültig/i)).toBeInTheDocument()
  })

  it('shows instructions about exact email requirement', () => {
    render(<SetupLinkPanel {...defaultProps} />)
    expect(screen.getByText(/anna@example.com/)).toBeInTheDocument()
  })

  it('calls onDismiss when dismissed', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<SetupLinkPanel {...defaultProps} onDismiss={onDismiss} />)
    await user.click(screen.getByRole('button', { name: /verstanden|schließen|ok/i }))
    expect(onDismiss).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "D:/Projects/Lebensordner" && npx vitest run tests/components/setup-link-panel.test.tsx 2>&1
```

Expected: FAIL.

- [ ] **Step 3: Create the component**

Create `src/components/trusted-access/SetupLinkPanel.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Copy, CheckCircle2, Clock, Mail, Shield, Info, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface SetupLinkPanelProps {
  recipientName: string
  recipientEmail: string
  setupUrl: string
  expiresAt: string
  onDismiss: () => void
}

export function SetupLinkPanel({ recipientName, recipientEmail, setupUrl, expiresAt, onDismiss }: SetupLinkPanelProps) {
  const [copied, setCopied] = useState(false)

  const expiryDate = new Date(expiresAt)
  const expiryLabel = expiryDate.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  async function handleCopy() {
    await navigator.clipboard.writeText(setupUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <Card className="border-sage-300 bg-sage-50">
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-sage-600 flex-shrink-0" />
            <span className="font-semibold text-sage-900 text-sm">Sicherer Zugriffslink erstellt</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onDismiss} className="h-7 w-7 -mt-0.5 -mr-1">
            <X className="w-3.5 h-3.5 text-warmgray-400" />
          </Button>
        </div>

        {/* Link field */}
        <div className="flex items-center gap-2 bg-white rounded-md border border-sage-200 px-3 py-2">
          <span className="text-xs text-warmgray-600 truncate flex-1 font-mono">{setupUrl}</span>
          <Button size="sm" variant="ghost" onClick={handleCopy} className="h-7 px-2 flex-shrink-0 text-sage-700 hover:bg-sage-100">
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-sage-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="ml-1.5 text-xs">{copied ? 'Kopiert' : 'Kopieren'}</span>
          </Button>
        </div>

        {/* Instructions */}
        <div className="space-y-1.5 text-xs text-sage-800">
          <div className="flex items-start gap-2">
            <Mail className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-sage-600" />
            <span>
              Senden Sie diesen Link manuell an <strong>{recipientName}</strong> ({recipientEmail}).
              Sie müssen sich mit genau dieser E-Mail-Adresse anmelden.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-sage-600" />
            <span>Link gültig bis <strong>{expiryLabel} Uhr</strong> — danach neuen Link erstellen.</span>
          </div>
          <div className="flex items-start gap-2">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-sage-600" />
            <span>{recipientName} muss einen E-Mail-Code bestätigen und dieses Gerät einrichten.</span>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={onDismiss}
          className="w-full border-sage-300 text-sage-700 hover:bg-sage-100"
        >
          Verstanden
        </Button>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "D:/Projects/Lebensordner" && npx vitest run tests/components/setup-link-panel.test.tsx 2>&1
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/trusted-access/SetupLinkPanel.tsx tests/components/setup-link-panel.test.tsx
git commit -m "feat: add SetupLinkPanel for post-copy setup link instructions"
```

---

### Task 5: Update `zugriff/page.tsx` — owner side

Replace generic trusted person card rows with `TrustedPersonStatusCard` and wire `SetupLinkPanel`. Update setup link creation to use `relationship_status` gating.

**Files:**
- Modify: `src/app/(dashboard)/zugriff/page.tsx`

**Key changes:**
1. Import `TrustedPersonStatusCard` and `SetupLinkPanel`
2. Add state for `setupLinkPanel: { personId: string; url: string; name: string; email: string; expiresAt: string } | null`
3. Update `handleGenerateRelationshipKey` → `handleCreateSetupLink`: gate on `relationship_status` (`accepted_pending_setup` or `setup_link_sent`), show `SetupLinkPanel` after success
4. Replace the active person card render block with `TrustedPersonStatusCard`
5. Render `SetupLinkPanel` below the list when `setupLinkPanel` state is set

- [ ] **Step 1: Add imports and state**

At the top of `zugriff/page.tsx`, add these imports:
```typescript
import { TrustedPersonStatusCard } from '@/components/trusted-access/TrustedPersonStatusCard'
import { SetupLinkPanel } from '@/components/trusted-access/SetupLinkPanel'
```

Add state after the existing state declarations (after `const [rkPostCopyStep, setRkPostCopyStep] = useState(false)`):
```typescript
const [setupLinkPanel, setSetupLinkPanel] = useState<{
  personId: string
  url: string
  name: string
  email: string
  expiresAt: string
} | null>(null)
```

- [ ] **Step 2: Add `handleCreateSetupLink` function**

Add this function near `handleGenerateRelationshipKey`:

```typescript
const handleCreateSetupLink = async (person: TrustedPerson) => {
  const status = person.relationship_status
  if (status !== 'accepted_pending_setup' && status !== 'setup_link_sent') {
    setError('Sicherer Link kann erst nach Annahme der Einladung erstellt werden.')
    return
  }

  if (!vaultContext.isUnlocked || !vaultContext.masterKey) {
    vaultContext.requestUnlock()
    return
  }

  setIsGeneratingRk(person.id)

  try {
    const { loadOrCreateRelationshipKeyMaterial } = await import('@/lib/security/relationship-key')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Nicht angemeldet')

    const relationshipKey = await loadOrCreateRelationshipKeyMaterial({
      supabase,
      ownerId: user.id,
      trustedPersonId: person.id,
      masterKey: vaultContext.masterKey,
    })

    // Use new setup-links route (per spec: all new work should prefer new route surface)
    const invitationResponse = await fetch('/api/trusted-access/setup-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trustedPersonId: person.id,
        bootstrapRelationshipKey: relationshipKey.hex,
      }),
    })
    const invitationData = await invitationResponse.json()
    if (!invitationResponse.ok) {
      throw new Error(invitationData.error || 'Sicherer Zugriffslink konnte nicht erstellt werden')
    }

    await fetchTrustedPersons(false)
    setSetupLinkPanel({
      personId: person.id,
      url: invitationData.invitationUrl,
      name: person.name,
      email: person.email,
      expiresAt: invitationData.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
  } catch (err: any) {
    setError('Fehler beim Erstellen des sicheren Zugriffslinks: ' + err.message)
  } finally {
    setIsGeneratingRk(null)
  }
}
```

- [ ] **Step 3: Replace the active person card render block**

Find the block starting at:
```typescript
{activePersons.map((person) => (
  <Card
    key={person.id}
    data-testid={`trusted-person-card-${person.id}`}
    className={`border-l-4 ...`}
  >
```

Replace the entire `activePersons.map(...)` block with:

```typescript
{activePersons.map((person) => (
  <TrustedPersonStatusCard
    key={person.id}
    person={person}
    isGeneratingSetupLink={isGeneratingRk === person.id}
    isSendingInvite={invitePendingById[person.id] ?? false}
    onCreateSetupLink={handleCreateSetupLink}
    onSendInvite={handleSendInvite}
    onEdit={handleOpenDialog}
    onDelete={handleDelete}
    onToggleActive={handleToggleActive}
  />
))}
```

- [ ] **Step 4: Add `SetupLinkPanel` below the trusted persons list**

In the Vertrauenspersonen tab content, after the trusted persons list `</div>` (after the `{trustedPersons.length > 0 && (...)}` block), add:

```typescript
{setupLinkPanel && (
  <SetupLinkPanel
    recipientName={setupLinkPanel.name}
    recipientEmail={setupLinkPanel.email}
    setupUrl={setupLinkPanel.url}
    expiresAt={setupLinkPanel.expiresAt}
    onDismiss={() => setSetupLinkPanel(null)}
  />
)}
```

- [ ] **Step 5: Remove the old RK dialog state and Dialog**

Remove all five state variables that belonged to the old "Sicherer Zugriffslink" dialog:
- `rkShareUrl`
- `rkShareExpiresAt`
- `isGeneratingRk` (if still referenced only by old dialog; it is reused by `handleCreateSetupLink` — keep it)
- `rkDialogOpen`
- `rkPostCopyStep`
- `rkLinkCopied`

Remove the old Dialog component (`<Dialog open={rkDialogOpen}>...</Dialog>`) and the `handleGenerateRelationshipKey` function (replaced by `handleCreateSetupLink`).

Note: `isGeneratingRk` is kept — `handleCreateSetupLink` uses it as the loading indicator for `TrustedPersonStatusCard`.

- [ ] **Step 5b: Verify TypeScript compilation after removal**

```bash
cd "D:/Projects/Lebensordner" && npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors. Fix any dangling references before proceeding.

- [ ] **Step 6: Verify TypeScript compilation**

```bash
cd "D:/Projects/Lebensordner" && npx tsc --noEmit 2>&1 | head -40
```

Expected: no TypeScript errors.

- [ ] **Step 7: Run existing zugriff tests**

```bash
cd "D:/Projects/Lebensordner" && npx vitest run tests/pages/zugriff.test.tsx 2>&1
```

Expected: PASS (existing tier tests still work).

- [ ] **Step 8: Commit**

```bash
git add src/app/(dashboard)/zugriff/page.tsx
git commit -m "feat: replace trusted person rows with TrustedPersonStatusCard and SetupLinkPanel"
```

---

## Chunk 2: Trusted User Side — Invitation, Redeem, Status View

### Task 6: Create shared `RelationshipEntry` type

Both `TrustedUserStatusView` (Task 9) and `ReceivedSharesList` (Task 10) use an identical `RelationshipEntry` type. Create it here so both components can import from one source.

**Files:**
- Create: `src/types/trusted-access-frontend.ts`

- [ ] **Step 1: Create the shared type file**

Create `src/types/trusted-access-frontend.ts`:

```typescript
/** Relationship state entry from GET /api/documents/share-token/received */
export interface RelationshipEntry {
  ownerId: string
  trustedPersonId: string
  status: 'not_linked_yet' | 'waiting_for_share'
  relationshipStatus: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/trusted-access-frontend.ts
git commit -m "feat: add shared RelationshipEntry type for trusted access frontend"
```

---

### Task 7: Update invitation page acceptance flow

Wire `POST /api/trusted-person/invitations/:id/accept` for the new relationship-aware acceptance. After acceptance, show guidance to wait for the owner's setup link.

**Files:**
- Modify: `src/app/(public)/einladung/[token]/page.tsx`

- [ ] **Step 1: Add `id` to the `InvitationData` interface**

At the top of the file, the `InvitationData` interface is:
```typescript
interface InvitationData {
  id: string
  name: string
  email: string
  relationship: string
  access_level: string
  owner_name: string
  invitation_status: string
}
```

Confirm `id: string` is present. If not, add it. The `GET /api/invitation?token=...` response already includes `id` (it is `trusted_persons.id`).

- [ ] **Step 2: Update `handleAccept` to call the new API**

In `einladung/[token]/page.tsx`, find `handleAccept`:

```typescript
const handleAccept = async () => {
  setIsProcessing(true)
  try {
    const response = await fetch('/api/invitation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action: 'accept', email: invitation?.email }),
    })
    ...
```

Replace with:

```typescript
const handleAccept = async () => {
  setIsProcessing(true)
  try {
    if (!invitation?.id) throw new Error('Einladung nicht gefunden')

    const response = await fetch(`/api/trusted-person/invitations/${invitation.id}/accept`, {
      method: 'POST',
    })
    const data = await response.json()

    if (!response.ok) {
      if (data.error === 'wrong_account') {
        setError(`Diese Einladung ist für eine andere E-Mail-Adresse bestimmt (${invitation?.email}). Bitte mit dem richtigen Konto anmelden.`)
        return
      }
      throw new Error(data.error || 'Fehler beim Akzeptieren')
    }

    setAccepted(true)
  } catch (err: any) {
    setError(err.message || 'Fehler beim Akzeptieren der Einladung.')
  } finally {
    setIsProcessing(false)
  }
}
```

- [ ] **Step 3: Update accepted state render**

Find the `accepted` state block in the render. It starts at:
```typescript
} : accepted ? (
  <div className="text-center">
    <div className="w-16 h-16 rounded-full bg-green-100 ...">
```

Replace the entire accepted content block with guidance to wait for the owner's setup link.

Note: Do NOT remove the `invitedNext` constant — it is still used in the unauthenticated "Konto erstellen" registration branch of the same render.

New accepted state block:
```typescript
} : accepted ? (
  <div className="text-center">
    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
      <CheckCircle2 className="w-8 h-8 text-green-600" />
    </div>
    <h2 className="text-xl font-semibold text-warmgray-900 mb-2">
      Einladung angenommen!
    </h2>
    <p className="text-warmgray-600 mb-2">
      Sie haben die Einladung von <strong>{invitation?.owner_name}</strong> angenommen.
    </p>
    <p className="text-warmgray-600 mb-6 text-sm">
      Als nächsten Schritt sendet Ihnen {invitation?.owner_name} einen sicheren Einrichtungslink.
      Sobald Sie diesen erhalten, können Sie den sicheren Zugriff einrichten.
    </p>
    <Button asChild variant="outline">
      <Link href="/zugriff">Zur Übersicht</Link>
    </Button>
  </div>
```

- [ ] **Step 4: Verify TypeScript compilation**

```bash
cd "D:/Projects/Lebensordner" && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(public)/einladung/[token]/page.tsx"
git commit -m "feat: wire invitation acceptance to POST /api/trusted-person/invitations/:id/accept"
```

---

### Task 8: Update redeem page to use new setup routes

Wire OTP and complete to `/api/trusted-access/setup/*` instead of legacy `/api/trusted-access/invitations/*`.

**Files:**
- Modify: `src/app/(dashboard)/zugriff/access/redeem/page.tsx`

The new backend routes are re-exports of the same logic, but using the new URL prefix correctly signals which flow is active. Also update to call `/api/trusted-access/setup/complete` and store the relationship key, then route to the status view.

- [ ] **Step 1: Update OTP send URL**

In `handleSendOtp`, change:
```typescript
const response = await fetch('/api/trusted-access/invitations/otp/send', {
```
To:
```typescript
const response = await fetch('/api/trusted-access/setup/otp/send', {
```

- [ ] **Step 2: Update OTP verify URL**

In `handleVerifyOtp`, change:
```typescript
const response = await fetch('/api/trusted-access/invitations/otp/verify', {
```
To:
```typescript
const response = await fetch('/api/trusted-access/setup/otp/verify', {
```

- [ ] **Step 3: Update complete URL and post-complete redirect**

In `handleComplete`, change the URL:
```typescript
const response = await fetch('/api/trusted-access/invitations/complete', {
```
To:
```typescript
const response = await fetch('/api/trusted-access/setup/complete', {
```

Update the redirect after completion to go to the trusted user status tab:
```typescript
window.setTimeout(() => {
  router.push('/zugriff?tab=mein-zugriff')
}, 1200)
```

(Instead of the old `router.push(data.redirectTo || '/vp-dashboard/view/...')`)

- [ ] **Step 4: Update pending state load to use setup claim URL**

In `loadPendingState`, keep using `/api/trusted-access/invitations/pending` (this is the compatibility wrapper that reads the setup cookie). No URL change needed here — this compatibility path still works.

- [ ] **Step 5: Verify TypeScript compilation**

```bash
cd "D:/Projects/Lebensordner" && npx tsc --noEmit 2>&1 | grep "redeem" | head -10
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/zugriff/access/redeem/page.tsx"
git commit -m "feat: update redeem page to use /api/trusted-access/setup/* routes"
```

---

### Task 9: Create `TrustedUserStatusView` component

Dedicated component for the trusted user perspective. Shows state when `GET /api/documents/share-token/received` returns no active shares, using the `relationships` array to determine next action.

**Files:**
- Create: `src/components/trusted-access/TrustedUserStatusView.tsx`
- Test: `tests/components/trusted-user-status-view.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/components/trusted-user-status-view.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { TrustedUserStatusView } from '@/components/trusted-access/TrustedUserStatusView'

describe('TrustedUserStatusView', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('shows loading state initially', () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as any // never resolves
    render(<TrustedUserStatusView />)
    expect(screen.getByText(/laden/i)).toBeInTheDocument()
  })

  it('shows not_linked_yet state when relationship is not active', async () => {
    // Constructor-time fn per MEMORY.md: survives vi.restoreAllMocks()
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        shares: [],
        relationships: [
          { ownerId: 'owner-1', trustedPersonId: 'tp-1', status: 'not_linked_yet', relationshipStatus: 'accepted_pending_setup' },
        ],
      }),
    })) as any

    render(<TrustedUserStatusView />)

    await waitFor(() => {
      expect(screen.getByText(/einrichtung/i)).toBeInTheDocument()
    })
  })

  it('shows waiting_for_share state when linked but no documents shared', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        shares: [],
        relationships: [
          { ownerId: 'owner-1', trustedPersonId: 'tp-1', status: 'waiting_for_share', relationshipStatus: 'active' },
        ],
      }),
    })) as any

    render(<TrustedUserStatusView />)

    await waitFor(() => {
      expect(screen.getByText(/verbindung hergestellt/i)).toBeInTheDocument()
    })
  })

  it('shows empty state when there are no relationships', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ shares: [], relationships: [] }),
    })) as any

    render(<TrustedUserStatusView />)

    await waitFor(() => {
      expect(screen.getByText(/keine einladungen/i)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "D:/Projects/Lebensordner" && npx vitest run tests/components/trusted-user-status-view.test.tsx 2>&1
```

Expected: FAIL.

- [ ] **Step 3: Create the component**

Create `src/components/trusted-access/TrustedUserStatusView.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, Clock, Link2, Loader2, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import type { RelationshipEntry } from '@/types/trusted-access-frontend'

interface TrustedAccessState {
  relationships: RelationshipEntry[]
  isLoading: boolean
  error: string | null
}

export function TrustedUserStatusView() {
  const [state, setState] = useState<TrustedAccessState>({
    relationships: [],
    isLoading: true,
    error: null,
  })

  // allowed: I/O - fetch received shares and relationship state
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/documents/share-token/received')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Fehler beim Laden')
        setState({
          relationships: data.relationships ?? [],
          isLoading: false,
          error: null,
        })
      } catch (err: any) {
        setState({ relationships: [], isLoading: false, error: err.message || 'Fehler beim Laden' })
      }
    }
    void load()
  }, [])

  if (state.isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-warmgray-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Laden…
      </div>
    )
  }

  if (state.error) {
    return <p className="text-sm text-red-600">{state.error}</p>
  }

  if (state.relationships.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Shield className="w-10 h-10 text-warmgray-300 mx-auto mb-3" />
          <p className="text-warmgray-600 text-sm">Keine Einladungen vorhanden.</p>
          <p className="text-warmgray-400 text-xs mt-1">
            Wenn Sie als Vertrauensperson eingeladen wurden, erscheint der Status hier nach der Annahme.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {state.relationships.map((rel) => (
        <RelationshipStatusCard key={rel.trustedPersonId} rel={rel} />
      ))}
    </div>
  )
}

function RelationshipStatusCard({ rel }: { rel: RelationshipEntry }) {
  if (rel.status === 'waiting_for_share') {
    return (
      <Card className="border-l-4 border-l-sage-400">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-sage-600" />
            </div>
            <div>
              <p className="font-semibold text-sage-900 text-sm">Verbindung hergestellt</p>
              <p className="text-warmgray-600 text-sm mt-0.5">
                Ihr Zugriff ist eingerichtet. Dokumente erscheinen hier, sobald sie freigegeben werden.
              </p>
              <div className="flex items-center gap-1.5 mt-2 text-xs text-warmgray-400">
                <Clock className="w-3 h-3" />
                Warten auf Freigaben des Besitzers
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // not_linked_yet — show state based on relationshipStatus
  const needsSetupLink = rel.relationshipStatus === 'setup_link_sent'
  const pendingAcceptance = rel.relationshipStatus === 'accepted_pending_setup'
  const invitedOnly = rel.relationshipStatus === 'invited'

  return (
    <Card className="border-l-4 border-l-amber-300">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Link2 className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            {invitedOnly && (
              <>
                <p className="font-semibold text-warmgray-900 text-sm">Einladung ausstehend</p>
                <p className="text-warmgray-600 text-sm mt-0.5">
                  Öffnen Sie den Einladungslink in Ihrer E-Mail, um die Einladung anzunehmen.
                </p>
              </>
            )}
            {pendingAcceptance && (
              <>
                <p className="font-semibold text-warmgray-900 text-sm">Einladung angenommen – Einrichtung ausstehend</p>
                <p className="text-warmgray-600 text-sm mt-0.5">
                  Der Besitzer sendet Ihnen noch einen sicheren Einrichtungslink. Bitte warten Sie.
                </p>
              </>
            )}
            {needsSetupLink && (
              <>
                <p className="font-semibold text-warmgray-900 text-sm">Sicheren Zugriff einrichten</p>
                <p className="text-warmgray-600 text-sm mt-0.5">
                  Sie haben einen sicheren Einrichtungslink erhalten. Öffnen Sie ihn, um fortzufahren.
                </p>
                <Button size="sm" className="mt-2 bg-sage-600 hover:bg-sage-700 text-white" asChild>
                  <Link href="/zugriff/access/redeem">Sicheren Zugriff einrichten</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "D:/Projects/Lebensordner" && npx vitest run tests/components/trusted-user-status-view.test.tsx 2>&1
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/trusted-access/TrustedUserStatusView.tsx tests/components/trusted-user-status-view.test.tsx
git commit -m "feat: add TrustedUserStatusView for trusted user status/task surface"
```

---

### Task 10: Update `ReceivedSharesList` to handle `relationships` response

When the API returns no active shares but has relationships, show the appropriate not_linked_yet or waiting_for_share state inline.

**Files:**
- Modify: `src/components/sharing/ReceivedSharesList.tsx`

- [ ] **Step 1: Add `relationships` to the fetch response and state**

In `ReceivedSharesList.tsx`, import the shared type and add state:

```typescript
// Add near the top imports:
import type { RelationshipEntry } from '@/types/trusted-access-frontend'
```

Add `CheckCircle2` to the existing lucide-react import (it is not currently imported in this file).

Add `relationships` state after the existing state declarations:
```typescript
const [relationships, setRelationships] = useState<RelationshipEntry[]>([])
```

Change `fetchShares`:
```typescript
async function fetchShares() {
  setIsLoading(true)
  setError(null)
  try {
    const res = await fetch('/api/documents/share-token/received')
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Fehler beim Laden')
    setShares(data.shares ?? [])
    setRelationships(data.relationships ?? [])
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : 'Fehler beim Laden')
  } finally {
    setIsLoading(false)
  }
}
```

- [ ] **Step 2: Replace the empty shares render block with relationship-aware states**

Find the current empty-state one-liner in `ReceivedSharesList.tsx`:
```typescript
if (shares.length === 0) {
  return <p className="text-warmgray-500 text-sm">Keine geteilten Dokumente vorhanden</p>
}
```

Replace the entire `if (shares.length === 0)` block with:
```typescript
if (shares.length === 0) {
  // Check if we have relationships explaining the empty state
  const waitingForShare = relationships.filter(r => r.status === 'waiting_for_share')
  const notLinkedYet = relationships.filter(r => r.status === 'not_linked_yet')

  if (waitingForShare.length > 0) {
    return (
      <div className="flex items-start gap-2 rounded-md bg-sage-50 border border-sage-200 px-3 py-3 text-sm text-sage-800">
        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-sage-600" />
        <div>
          <p className="font-medium">Verbindung hergestellt</p>
          <p className="text-sage-700 text-xs mt-0.5">
            Dokumente erscheinen hier, sobald der Besitzer sie freigibt.
          </p>
        </div>
      </div>
    )
  }

  if (notLinkedYet.length > 0) {
    return (
      <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-3 text-sm text-amber-800">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium">Sicherer Zugriff noch nicht eingerichtet</p>
          <p className="text-amber-700 text-xs mt-0.5">
            Sobald der sichere Zugriff abgeschlossen ist, erscheinen freigegebene Dokumente hier.
          </p>
        </div>
      </div>
    )
  }

  return <p className="text-warmgray-500 text-sm">Keine geteilten Dokumente vorhanden</p>
}
```

Add `CheckCircle2` to imports from lucide-react.

- [ ] **Step 3: Verify TypeScript compilation**

```bash
cd "D:/Projects/Lebensordner" && npx tsc --noEmit 2>&1 | grep "ReceivedSharesList\|received-shares" | head -10
```

Expected: no errors.

- [ ] **Step 4: Run existing sharing tests**

```bash
cd "D:/Projects/Lebensordner" && npx vitest run tests/components/sharing.test.tsx 2>&1
```

Expected: PASS (existing tests still work).

- [ ] **Step 5: Commit**

```bash
git add src/components/sharing/ReceivedSharesList.tsx
git commit -m "feat: handle relationships state in ReceivedSharesList for not_linked_yet and waiting_for_share"
```

---

### Task 11: Add "Mein Zugriff" tab to `zugriff/page.tsx`

Add a third tab for the trusted user perspective, showing `TrustedUserStatusView`. This gives trusted users a stable status surface.

**Files:**
- Modify: `src/app/(dashboard)/zugriff/page.tsx`

- [ ] **Step 1: Import TrustedUserStatusView**

Add to existing imports:
```typescript
import { TrustedUserStatusView } from '@/components/trusted-access/TrustedUserStatusView'
```

- [ ] **Step 2: Handle `tab` query param for deep linking**

In the existing hash-based tab handling (near line 182):
```typescript
useEffect(() => {
  if (typeof window === 'undefined') return
  if (window.location.hash === '#familie') {
    setActiveMainTab('familie')
  }
}, [])
```

Extend to also handle the `?tab=mein-zugriff` query param used by the redeem page redirect:
```typescript
useEffect(() => {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  if (params.get('tab') === 'mein-zugriff') {
    setActiveMainTab('mein-zugriff')
    window.history.replaceState(null, '', window.location.pathname)
  } else if (window.location.hash === '#familie') {
    setActiveMainTab('familie')
  }
}, [])
```

- [ ] **Step 3: Add the tab trigger**

Find the `<TabsList>` block with Vertrauenspersonen and Familie triggers. Add a third trigger:
```typescript
<TabsTrigger value="mein-zugriff" className="flex-1 sm:flex-initial">
  <Shield className="w-4 h-4 mr-2" aria-hidden="true" />
  Mein Zugriff
</TabsTrigger>
```

- [ ] **Step 4: Add the tab content**

After the Familie `<TabsContent>` closing tag, add:
```typescript
{/* Mein Zugriff Tab Content - trusted user perspective */}
<TabsContent value="mein-zugriff" className="space-y-6 mt-6">
  <div>
    <h2 className="text-xl font-semibold text-warmgray-900 mb-1">Mein Zugriff</h2>
    <p className="text-sm text-warmgray-600">
      Status Ihrer Einladungen und freigegebenen Dokumente
    </p>
  </div>
  <TrustedUserStatusView />
</TabsContent>
```

- [ ] **Step 5: Verify TypeScript compilation**

```bash
cd "D:/Projects/Lebensordner" && npx tsc --noEmit 2>&1 | grep "zugriff/page" | head -10
```

Expected: no errors.

- [ ] **Step 6: Run zugriff page tests**

```bash
cd "D:/Projects/Lebensordner" && npx vitest run tests/pages/zugriff.test.tsx 2>&1
```

Expected: PASS (existing tier tests unaffected by new tab).

- [ ] **Step 7: Run full test suite**

```bash
cd "D:/Projects/Lebensordner" && npx vitest run 2>&1 | tail -30
```

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/(dashboard)/zugriff/page.tsx
git commit -m "feat: add Mein Zugriff tab for trusted user status surface"
```

---

## Final Integration Check

- [ ] **Full TypeScript compilation**

```bash
cd "D:/Projects/Lebensordner" && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Full test suite**

```bash
cd "D:/Projects/Lebensordner" && npx vitest run 2>&1 | tail -30
```

Expected: all tests PASS.

- [ ] **Manual verification checklist**

Owner side:
- [ ] `invited` person → shows 5-step checklist, step 1 highlighted, "Auf Annahme warten" label, "Einladung erneut senden" button
- [ ] `accepted_pending_setup` person → step 2 highlighted, "Sicheren Link erstellen" CTA enabled
- [ ] After creating link → `SetupLinkPanel` appears with URL, email, expiry, instructions
- [ ] `setup_link_sent` person → step 3 highlighted, "Neuen Link senden" CTA
- [ ] `active` person → step 5 highlighted, "Dokumente freigeben" label
- [ ] Share dialog only shows `active` trusted persons as eligible recipients

Trusted user side:
- [ ] Accept invitation → calls `/api/trusted-person/invitations/:id/accept`
- [ ] After acceptance → shows guidance to wait for setup link
- [ ] Redeem page → OTP and complete use `/api/trusted-access/setup/*` routes
- [ ] After setup complete → redirects to `/zugriff?tab=mein-zugriff`
- [ ] "Mein Zugriff" tab → `not_linked_yet` shows "Einrichtung ausstehend"
- [ ] "Mein Zugriff" tab → `waiting_for_share` shows "Verbindung hergestellt"
- [ ] `ReceivedSharesList` → shows relationship state when no active shares

- [ ] **Final verification note**

All individual task commits should already be made. If there are any unstaged changes remaining from the integration checks, stage only the files you modified and commit them by file name — do not use `git add -A` or `git add .`. Temp plan files are kept as-is per the spec (no deletion during frontend pass).
