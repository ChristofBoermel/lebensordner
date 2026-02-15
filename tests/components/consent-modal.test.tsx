import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ConsentModal } from '@/components/consent/consent-modal'

describe('ConsentModal', () => {
  it('should render with title and description', () => {
    render(
      <ConsentModal
        isOpen
        onAccept={vi.fn().mockResolvedValue(undefined)}
        title="Test Title"
        description="Test description"
      />
    )

    expect(screen.getByText('Test Title')).toBeInTheDocument()
    expect(screen.getByText('Test description')).toBeInTheDocument()
  })

  it('should render custom content when provided', () => {
    render(
      <ConsentModal
        isOpen
        onAccept={vi.fn().mockResolvedValue(undefined)}
        title="Test Title"
        content={<div>Custom Content</div>}
      />
    )

    expect(screen.getByText('Custom Content')).toBeInTheDocument()
  })

  it('should disable accept button when requireCheckbox=true and unchecked', () => {
    render(
      <ConsentModal
        isOpen
        onAccept={vi.fn().mockResolvedValue(undefined)}
        title="Test Title"
        requireCheckbox
        checkboxLabel="I agree"
      />
    )

    const acceptButton = screen.getByRole('button', { name: 'Ich stimme zu' })
    expect(acceptButton).toBeDisabled()
  })

  it('should enable accept button when checkbox is checked', () => {
    render(
      <ConsentModal
        isOpen
        onAccept={vi.fn().mockResolvedValue(undefined)}
        title="Test Title"
        requireCheckbox
        checkboxLabel="I agree"
      />
    )

    const checkbox = screen.getByLabelText('I agree')
    fireEvent.click(checkbox)

    const acceptButton = screen.getByRole('button', { name: 'Ich stimme zu' })
    expect(acceptButton).toBeEnabled()
  })

  it('should show loading state when onAccept is in progress', async () => {
    let resolveAccept: (() => void) | undefined
    const onAccept = vi.fn(() => new Promise<void>((resolve) => {
      resolveAccept = resolve
    }))

    render(
      <ConsentModal
        isOpen
        onAccept={onAccept}
        title="Test Title"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ich stimme zu' }))

    expect(screen.getByRole('button', { name: /wird gespeichert/i })).toBeDisabled()

    resolveAccept?.()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ich stimme zu' })).toBeEnabled()
    })
  })

  it('should call onAccept when accept button clicked', async () => {
    const onAccept = vi.fn().mockResolvedValue(undefined)

    render(
      <ConsentModal
        isOpen
        onAccept={onAccept}
        title="Test Title"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ich stimme zu' }))

    await waitFor(() => {
      expect(onAccept).toHaveBeenCalled()
    })
  })

  it('should call onDecline when decline button clicked', () => {
    const onDecline = vi.fn()

    render(
      <ConsentModal
        isOpen
        onAccept={vi.fn().mockResolvedValue(undefined)}
        onDecline={onDecline}
        title="Test Title"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ablehnen' }))

    expect(onDecline).toHaveBeenCalled()
  })

  it('should not allow dismiss when canDismiss=false', () => {
    const onDecline = vi.fn()

    render(
      <ConsentModal
        isOpen
        onAccept={vi.fn().mockResolvedValue(undefined)}
        onDecline={onDecline}
        title="Test Title"
        canDismiss={false}
      />
    )

    const closeButton = screen.getByText('Schließen').closest('button')
    if (closeButton) {
      fireEvent.click(closeButton)
    }

    expect(onDecline).not.toHaveBeenCalled()
  })

  it('should hide close button when canDismiss=false', () => {
    render(
      <ConsentModal
        isOpen
        onAccept={vi.fn().mockResolvedValue(undefined)}
        title="Test Title"
        canDismiss={false}
      />
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('[&>button]:hidden')
  })

  it('should reset checkbox state when modal closes', () => {
    const { rerender } = render(
      <ConsentModal
        isOpen
        onAccept={vi.fn().mockResolvedValue(undefined)}
        title="Test Title"
        requireCheckbox
        checkboxLabel="I agree"
      />
    )

    const checkbox = screen.getByLabelText('I agree')
    fireEvent.click(checkbox)

    rerender(
      <ConsentModal
        isOpen={false}
        onAccept={vi.fn().mockResolvedValue(undefined)}
        title="Test Title"
        requireCheckbox
        checkboxLabel="I agree"
      />
    )

    rerender(
      <ConsentModal
        isOpen
        onAccept={vi.fn().mockResolvedValue(undefined)}
        title="Test Title"
        requireCheckbox
        checkboxLabel="I agree"
      />
    )

    expect(screen.getByLabelText('I agree')).not.toBeChecked()
  })

  it('should reset loading state when modal closes', async () => {
    let resolveAccept: (() => void) | undefined
    const onAccept = vi.fn(() => new Promise<void>((resolve) => {
      resolveAccept = resolve
    }))

    const { rerender } = render(
      <ConsentModal
        isOpen
        onAccept={onAccept}
        title="Test Title"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ich stimme zu' }))
    expect(screen.getByRole('button', { name: /wird gespeichert/i })).toBeDisabled()

    rerender(
      <ConsentModal
        isOpen={false}
        onAccept={onAccept}
        title="Test Title"
      />
    )

    rerender(
      <ConsentModal
        isOpen
        onAccept={onAccept}
        title="Test Title"
      />
    )

    resolveAccept?.()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ich stimme zu' })).toBeEnabled()
    })
  })
})
