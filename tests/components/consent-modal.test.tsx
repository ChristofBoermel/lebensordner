import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConsentModal } from '@/components/consent/consent-modal'

function renderConsentModal({
  onAccept = vi.fn().mockResolvedValue(undefined),
  onDecline,
  withCheckbox = false,
}: {
  onAccept?: () => Promise<void>
  onDecline?: () => void
  withCheckbox?: boolean
} = {}) {
  return render(
    <ConsentModal isOpen onAccept={onAccept} onDecline={onDecline}>
      <ConsentModal.Header>Einwilligung</ConsentModal.Header>
      <ConsentModal.Body>
        <p>Bitte lesen und bestätigen.</p>
      </ConsentModal.Body>
      {withCheckbox ? <ConsentModal.Checkbox label="Ich stimme zu" /> : null}
      <ConsentModal.Footer />
    </ConsentModal>
  )
}

describe('ConsentModal', () => {
  it('renders composed header and body content', () => {
    renderConsentModal()

    expect(screen.getByText('Einwilligung')).toBeInTheDocument()
    expect(screen.getByText('Bitte lesen und bestätigen.')).toBeInTheDocument()
  })

  it('disables accept button when checkbox is composed and unchecked', () => {
    renderConsentModal({ withCheckbox: true })

    expect(screen.getByRole('button', { name: 'Ich stimme zu' })).toBeDisabled()
  })

  it('enables accept button after checkbox confirmation', () => {
    renderConsentModal({ withCheckbox: true })

    fireEvent.click(screen.getByLabelText('Ich stimme zu'))

    expect(screen.getByRole('button', { name: 'Ich stimme zu' })).toBeEnabled()
  })

  it('calls onAccept and shows loading state while saving', async () => {
    let resolveAccept: (() => void) | undefined
    const onAccept = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveAccept = resolve
        })
    )

    renderConsentModal({ onAccept })

    fireEvent.click(screen.getByRole('button', { name: 'Ich stimme zu' }))

    expect(screen.getByRole('button', { name: /wird gespeichert/i })).toBeDisabled()
    expect(onAccept).toHaveBeenCalledTimes(1)

    resolveAccept?.()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ich stimme zu' })).toBeEnabled()
    })
  })

  it('keeps dismiss controls for dismissible composition', () => {
    const onDecline = vi.fn()
    renderConsentModal({ onDecline })

    const closeButton = screen.getByRole('button', { name: 'Schließen' })
    fireEvent.click(closeButton)

    expect(onDecline).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Ablehnen' })).toBeInTheDocument()
  })

  it('hides dismiss controls for non-dismissible composition', () => {
    renderConsentModal()

    expect(screen.queryByRole('button', { name: 'Schließen' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ablehnen' })).not.toBeInTheDocument()
  })

  it('prevents escape dismissal when composed as non-dismissible', () => {
    renderConsentModal()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Schließen' })).not.toBeInTheDocument()
  })
})
