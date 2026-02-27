import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BmpScanDialog } from '@/components/notfall/BmpScanDialog'

// Capture onDrop so tests can trigger it directly
let capturedOnDrop: ((files: File[]) => void) | null = null

vi.mock('react-dropzone', () => ({
  useDropzone: (opts: { onDrop?: (files: File[]) => void } = {}) => {
    if (opts.onDrop) capturedOnDrop = opts.onDrop
    return {
      getRootProps: () => ({}),
      getInputProps: () => ({}),
      isDragActive: false,
      open: vi.fn(),
    }
  },
}))

vi.mock('@zxing/library', () => ({
  BrowserMultiFormatReader: vi.fn().mockImplementation(() => ({
    decodeFromImageUrl: vi.fn().mockResolvedValue({ getText: () => '<xml/>' }),
    decodeFromVideoDevice: vi.fn(),
    reset: vi.fn(),
  })),
}))

vi.mock('@/lib/bmp/bmp-xml-parser', () => ({
  parseBmpXml: vi.fn(() => [{ wirkstoff: 'Aspirin', staerke: '100 mg', form: 'Tablette' }]),
}))

describe('BmpScanDialog — PreviewEditDialog form fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedOnDrop = null
    global.URL.createObjectURL = vi.fn(() => 'blob:mock')
    global.URL.revokeObjectURL = vi.fn()
  })

  const openEditDialog = async () => {
    render(
      <BmpScanDialog
        open={true}
        onOpenChange={vi.fn()}
        onMedicationsScanned={vi.fn().mockResolvedValue(undefined)}
        existingMedications={[]}
      />
    )

    // Trigger file drop which advances scanState to 'preview'
    await act(async () => {
      capturedOnDrop?.([new File([''], 'bmp.jpg', { type: 'image/jpeg' })])
    })

    // Wait for the preview list — "Übernehmen" button signals preview state
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Übernehmen/i })).toBeInTheDocument()
    })

    // Click the icon-only edit button (empty textContent — only an SVG icon,
    // unlike the Dialog close button which has a sr-only "Schließen" span)
    const allButtons = screen.getAllByRole('button')
    const editButton = allButtons.find(
      (btn) => !btn.textContent?.trim()
    )
    expect(editButton).toBeDefined()
    await userEvent.click(editButton!)

    // Wait for PreviewEditDialog to open — Wirkstoff * label appears
    await waitFor(() => {
      expect(screen.getByText('Wirkstoff *')).toBeInTheDocument()
    })
  }

  it('Form label reads "Form"', async () => {
    await openEditDialog()
    expect(screen.getByText('Form')).toBeInTheDocument()
  })

  it('Einheit placeholder is "z.B. Stück"', async () => {
    await openEditDialog()
    expect(screen.getByPlaceholderText('z.B. Stück')).toBeInTheDocument()
  })
})
