import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RecipientVerificationForm } from '@/components/download/RecipientVerificationForm'

describe('RecipientVerificationForm', () => {
  const token = 'test-token-abc'
  const onVerified = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = vi.fn()
  })

  it('renders email input and disabled submit button when email is empty', () => {
    render(<RecipientVerificationForm token={token} onVerified={onVerified} />)
    expect(screen.getByLabelText(/empfänger-e-mail/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /prüfen/i })).toBeDisabled()
  })

  it('enables submit button when email is entered', () => {
    render(<RecipientVerificationForm token={token} onVerified={onVerified} />)
    fireEvent.change(screen.getByLabelText(/empfänger-e-mail/i), {
      target: { value: 'test@example.com' },
    })
    expect(screen.getByRole('button', { name: /prüfen/i })).not.toBeDisabled()
  })

  it('calls onVerified on success (200)', async () => {
    ;(global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    )
    render(<RecipientVerificationForm token={token} onVerified={onVerified} />)
    fireEvent.change(screen.getByLabelText(/empfänger-e-mail/i), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /prüfen/i }))
    await waitFor(() => expect(onVerified).toHaveBeenCalledOnce())
  })

  it('shows wrong-email error on 403', async () => {
    ;(global.fetch as any).mockResolvedValue(
      new Response(
        JSON.stringify({ error: 'Empfänger-E-Mail stimmt nicht überein' }),
        { status: 403 }
      )
    )
    render(<RecipientVerificationForm token={token} onVerified={onVerified} />)
    fireEvent.change(screen.getByLabelText(/empfänger-e-mail/i), {
      target: { value: 'wrong@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /prüfen/i }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('stimmt nicht überein')
    )
    expect(onVerified).not.toHaveBeenCalled()
  })

  it('shows rate-limit error on 429', async () => {
    ;(global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 })
    )
    render(<RecipientVerificationForm token={token} onVerified={onVerified} />)
    fireEvent.change(screen.getByLabelText(/empfänger-e-mail/i), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /prüfen/i }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Zu viele Versuche')
    )
  })

  it('shows generic error on network failure', async () => {
    ;(global.fetch as any).mockRejectedValue(new Error('Network error'))
    render(<RecipientVerificationForm token={token} onVerified={onVerified} />)
    fireEvent.change(screen.getByLabelText(/empfänger-e-mail/i), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /prüfen/i }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Verbindungsfehler')
    )
  })

  it('submits on Enter key press', async () => {
    ;(global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    )
    render(<RecipientVerificationForm token={token} onVerified={onVerified} />)
    const input = screen.getByLabelText(/empfänger-e-mail/i)
    fireEvent.change(input, { target: { value: 'user@example.com' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(onVerified).toHaveBeenCalledOnce())
  })
})
