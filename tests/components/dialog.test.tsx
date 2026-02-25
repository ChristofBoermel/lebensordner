import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog'

describe('DialogContent', () => {
  it('close button precedes children in DOM order', () => {
    render(
      <Dialog open>
        <DialogContent>
          <div data-testid="scroll-area">Content</div>
        </DialogContent>
      </Dialog>
    )

    const closeButton = screen.getByText('Schließen', { selector: '.sr-only' })?.closest('button')
    const scrollArea = screen.getByTestId('scroll-area')

    expect(closeButton).toBeInTheDocument()
    expect(scrollArea).toBeInTheDocument()

    // DOCUMENT_POSITION_FOLLOWING (4) means scrollArea comes after closeButton in DOM
    const position = closeButton!.compareDocumentPosition(scrollArea)
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('DialogContent has max-h-[85vh] class by default (regression guard)', () => {
    render(
      <Dialog open>
        <DialogContent>Content</DialogContent>
      </Dialog>
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveClass('max-h-[85vh]')
  })
})
