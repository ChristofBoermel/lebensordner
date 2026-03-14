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
