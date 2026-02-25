import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---- Module mocks ----

vi.mock('@zxing/library', () => ({
  BrowserMultiFormatReader: vi.fn().mockImplementation(() => ({
    decodeFromVideoDevice: vi.fn().mockResolvedValue(undefined),
    decodeFromImageUrl: vi.fn().mockResolvedValue({ getText: () => '<MP></MP>' }),
    reset: vi.fn(),
  })),
}))

vi.mock('react-dropzone', () => ({
  useDropzone: vi.fn(() => ({
    getRootProps: () => ({ 'data-testid': 'dropzone' }),
    getInputProps: () => ({ type: 'file' }),
    isDragActive: false,
    open: vi.fn(),
  })),
}))

const mockParseBmpXml = vi.fn()
vi.mock('@/lib/bmp/bmp-xml-parser', () => ({
  parseBmpXml: (...args: unknown[]) => mockParseBmpXml(...args),
}))

// ---- Component ----

import { BmpScanDialog } from '@/components/notfall/BmpScanDialog'
import { useDropzone } from 'react-dropzone'

const mockUseDropzone = useDropzone as unknown as ReturnType<typeof vi.fn>

// ---- Helpers ----

const makeMedication = (overrides: Record<string, unknown> = {}) => ({
  wirkstoff: 'Aspirin',
  staerke: '100 mg',
  form: 'Tablette',
  ...overrides,
})

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  onMedicationsScanned: vi.fn().mockResolvedValue(undefined),
  existingMedications: [],
}

// ---- Tests ----

describe('BmpScanDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockParseBmpXml.mockReturnValue([])
    mockUseDropzone.mockReturnValue({
      getRootProps: () => ({ 'data-testid': 'dropzone' }),
      getInputProps: () => ({ type: 'file' }),
      isDragActive: false,
      open: vi.fn(),
    })
  })

  it('renders in idle state without errors', () => {
    render(<BmpScanDialog {...defaultProps} />)

    expect(screen.getByText('Bundesmedikationsplan scannen')).toBeInTheDocument()
    expect(screen.getByText('Bild hochladen')).toBeInTheDocument()
    expect(screen.getByText('Kamera')).toBeInTheDocument()
  })

  it('renders in preview state without errors (no insertBefore crash)', async () => {
    let capturedOnDrop: ((files: File[]) => void) | undefined
    mockUseDropzone.mockImplementation(({ onDrop }: { onDrop: (files: File[]) => void }) => {
      capturedOnDrop = onDrop
      return {
        getRootProps: () => ({ 'data-testid': 'dropzone' }),
        getInputProps: () => ({ type: 'file' }),
        isDragActive: false,
        open: vi.fn(),
      }
    })

    mockParseBmpXml.mockReturnValue([makeMedication()])

    render(<BmpScanDialog {...defaultProps} />)

    const file = new File(['<dummy>'], 'bmp.png', { type: 'image/png' })

    await act(async () => {
      capturedOnDrop?.([file])
    })

    await waitFor(() => {
      expect(screen.getByText('Übernehmen')).toBeInTheDocument()
    })

    expect(screen.getByText(/Medikament erkannt/)).toBeInTheDocument()
  })

  it('renders in error state without errors', async () => {
    let capturedOnDrop: ((files: File[]) => void) | undefined
    mockUseDropzone.mockImplementation(({ onDrop }: { onDrop: (files: File[]) => void }) => {
      capturedOnDrop = onDrop
      return {
        getRootProps: () => ({ 'data-testid': 'dropzone' }),
        getInputProps: () => ({ type: 'file' }),
        isDragActive: false,
        open: vi.fn(),
      }
    })

    // parseBmpXml returns empty → error state
    mockParseBmpXml.mockReturnValue([])

    render(<BmpScanDialog {...defaultProps} />)

    const file = new File(['<dummy>'], 'bmp.png', { type: 'image/png' })

    await act(async () => {
      capturedOnDrop?.([file])
    })

    await waitFor(() => {
      expect(screen.getByText('Erneut versuchen')).toBeInTheDocument()
    })
  })

  it('transitions from idle → preview → idle without unmounting errors', async () => {
    let capturedOnDrop: ((files: File[]) => void) | undefined
    mockUseDropzone.mockImplementation(({ onDrop }: { onDrop: (files: File[]) => void }) => {
      capturedOnDrop = onDrop
      return {
        getRootProps: () => ({ 'data-testid': 'dropzone' }),
        getInputProps: () => ({ type: 'file' }),
        isDragActive: false,
        open: vi.fn(),
      }
    })

    mockParseBmpXml.mockReturnValue([makeMedication()])

    render(<BmpScanDialog {...defaultProps} />)

    // Verify idle state
    expect(screen.getByText('Bild hochladen')).toBeInTheDocument()

    const file = new File(['<dummy>'], 'bmp.png', { type: 'image/png' })

    // Transition to preview
    await act(async () => {
      capturedOnDrop?.([file])
    })

    await waitFor(() => {
      expect(screen.getByText('Übernehmen')).toBeInTheDocument()
    })

    // Transition back to idle via cancel
    const cancelButton = screen.getByText('Abbrechen')
    await userEvent.click(cancelButton)

    await waitFor(() => {
      expect(screen.getByText('Bild hochladen')).toBeInTheDocument()
    })
  })

  it('shows scanned medication list in preview state', async () => {
    let capturedOnDrop: ((files: File[]) => void) | undefined
    mockUseDropzone.mockImplementation(({ onDrop }: { onDrop: (files: File[]) => void }) => {
      capturedOnDrop = onDrop
      return {
        getRootProps: () => ({ 'data-testid': 'dropzone' }),
        getInputProps: () => ({ type: 'file' }),
        isDragActive: false,
        open: vi.fn(),
      }
    })

    mockParseBmpXml.mockReturnValue([
      makeMedication({ wirkstoff: 'Aspirin', staerke: '100 mg' }),
      makeMedication({ wirkstoff: 'Ibuprofen', staerke: '400 mg' }),
    ])

    render(<BmpScanDialog {...defaultProps} />)

    const file = new File(['<dummy>'], 'bmp.png', { type: 'image/png' })

    await act(async () => {
      capturedOnDrop?.([file])
    })

    await waitFor(() => {
      expect(screen.getByText('Aspirin')).toBeInTheDocument()
      expect(screen.getByText('Ibuprofen')).toBeInTheDocument()
    })

    expect(screen.getByText(/2 Medikamente erkannt/)).toBeInTheDocument()
  })

  it('calls onMedicationsScanned and closes on confirm', async () => {
    const onMedicationsScanned = vi.fn().mockResolvedValue(undefined)
    const onOpenChange = vi.fn()

    let capturedOnDrop: ((files: File[]) => void) | undefined
    mockUseDropzone.mockImplementation(({ onDrop }: { onDrop: (files: File[]) => void }) => {
      capturedOnDrop = onDrop
      return {
        getRootProps: () => ({ 'data-testid': 'dropzone' }),
        getInputProps: () => ({ type: 'file' }),
        isDragActive: false,
        open: vi.fn(),
      }
    })

    const meds = [makeMedication({ wirkstoff: 'Metformin' })]
    mockParseBmpXml.mockReturnValue(meds)

    render(
      <BmpScanDialog
        open={true}
        onOpenChange={onOpenChange}
        onMedicationsScanned={onMedicationsScanned}
        existingMedications={[]}
      />
    )

    const file = new File(['<dummy>'], 'bmp.png', { type: 'image/png' })

    await act(async () => {
      capturedOnDrop?.([file])
    })

    await waitFor(() => {
      expect(screen.getByText('Übernehmen')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Übernehmen'))

    await waitFor(() => {
      expect(onMedicationsScanned).toHaveBeenCalledWith(meds)
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })
})
