import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TrustedPersonStatusCard } from '@/components/trusted-access/TrustedPersonStatusCard'

const basePerson = {
  id: 'tp-1',
  name: 'Anna Mueller',
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
  invitation_sent_at: new Date().toISOString(),
  invitation_expires_at: null,
  invitation_accepted_at: null,
  email_status: 'sent',
}

describe('TrustedPersonStatusCard', () => {
  it('shows "Einladen" and waiting state for invited contacts before the first send', () => {
    render(
      <TrustedPersonStatusCard
        person={{
          ...basePerson,
          relationship_status: 'invited',
          invitation_status: null,
          invitation_sent_at: null,
          email_status: null,
        }}
        isGeneratingSetupLink={false}
        onCreateSetupLink={vi.fn()}
        onSendInvite={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleActive={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /^einladen$/i })).toBeInTheDocument()
    expect(screen.getByText('Auf Annahme warten')).toBeInTheDocument()
  })

  it('shows "Einladung gesendet" state for invited contacts after a send attempt', () => {
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
    expect(screen.getByRole('button', { name: /^einladung erneut senden$/i })).toBeInTheDocument()
    expect(screen.getByTestId('trusted-person-status-tp-1')).toHaveTextContent('Einladung gesendet')
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

  it('shows the next-step CTA for active status', () => {
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
    expect(screen.getByText(/Freigaben einrichten/)).toBeInTheDocument()
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
    expect(screen.getAllByText('Einladung gesendet')).toHaveLength(2)
    expect(screen.getByText('Einladung angenommen')).toBeInTheDocument()
    expect(screen.getByText('Sicheren Zugriff einrichten')).toBeInTheDocument()
    expect(screen.getByText('Dokumente freigeben')).toBeInTheDocument()
    expect(screen.getByText('Zugriff aktiv')).toBeInTheDocument()
  })
})
