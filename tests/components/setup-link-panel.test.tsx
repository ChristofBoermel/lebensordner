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
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Senden Sie diesen Link/)).toBeInTheDocument()
    expect(screen.getByText(/anna@example.com/)).toBeInTheDocument()
  })

  it('shows the setup link URL', () => {
    render(<SetupLinkPanel {...defaultProps} />)
    expect(screen.getByText('https://example.com/setup?token=abc123')).toBeInTheDocument()
  })

  it('shows expiry information', () => {
    render(<SetupLinkPanel {...defaultProps} />)
    expect(screen.getByText(/gueltig|gültig/i)).toBeInTheDocument()
  })

  it('shows instructions about exact email requirement', () => {
    render(<SetupLinkPanel {...defaultProps} />)
    expect(screen.getByText(/anna@example.com/)).toBeInTheDocument()
  })

  it('calls onDismiss when dismissed', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<SetupLinkPanel {...defaultProps} onDismiss={onDismiss} />)
    await user.click(screen.getByRole('button', { name: /verstanden/i }))
    expect(onDismiss).toHaveBeenCalled()
  })
})
