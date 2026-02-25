import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExportPage from '@/app/(dashboard)/export/page'
import { createSupabaseMock } from '../mocks/supabase-client'
import QRCode from 'qrcode'

const profileData = {
  full_name: 'Max Mustermann',
  email: 'max@example.com',
  date_of_birth: '1990-03-12',
}

const { client: mockSupabaseClient } = createSupabaseMock({
  single: { data: profileData, error: null },
  getUser: { data: { user: { id: 'test-user-id', email: 'max@example.com' } }, error: null },
  then: { data: [], error: null },
})

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}))

vi.mock('@/lib/vault/VaultContext', () => ({
  useVault: () => ({
    isSetUp: false,
    isUnlocked: false,
    masterKey: null,
    setup: vi.fn(),
    unlock: vi.fn(),
    unlockWithRecovery: vi.fn(),
    lock: vi.fn(),
  }),
}))

vi.mock('@/components/vault/VaultUnlockModal', () => ({
  VaultUnlockModal: () => null,
}))

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(),
  },
}))

const mockDocText = vi.fn()
const mockDoc = {
  text: mockDocText,
  addPage: vi.fn(),
  setFontSize: vi.fn(),
  setFont: vi.fn(),
  setPage: vi.fn(),
  save: vi.fn(),
  internal: {
    pageSize: {
      getWidth: vi.fn(() => 210),
      getHeight: vi.fn(() => 297),
    },
    pages: [null, 'page1'],
  },
}

vi.mock('jspdf', () => ({
  default: vi.fn(() => mockDoc),
}))

vi.mock('jspdf-autotable', () => ({
  default: vi.fn(),
}))

const createResponse = (data: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
}) as Response

const getQrCodeMock = () => QRCode as unknown as { toDataURL: ReturnType<typeof vi.fn> }

const renderAndCapturePayload = async () => {
  let payload = ''
  getQrCodeMock().toDataURL.mockImplementation(async (text: string) => {
    payload = text
    return 'data:image/png;base64,abc'
  })

  render(<ExportPage />)

  await waitFor(() => {
    expect(getQrCodeMock().toDataURL).toHaveBeenCalled()
  })

  return payload
}

describe('Export emergency QR payload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/notfall')) {
        return Promise.resolve(
          createResponse({
            emergencyContacts: [
              {
                id: 'contact-1',
                name: 'Erika Musterfrau',
                phone: '+49123456789',
                email: null,
                relationship: 'Partner',
                is_primary: true,
              },
            ],
            medicalInfo: {
              allergies: ['Pollen'],
              medications: [{ wirkstoff: 'Ibuprofen', staerke: '400 mg', grund: 'Schmerzen' }],
              medication_plan_updated_at: '2024-07-15T00:00:00.000Z',
              conditions: [],
              doctor_name: 'Dr. Beispiel',
              doctor_phone: '040-123456',
              insurance_number: null,
              organ_donor: null,
              vaccinations: [{ name: 'Tetanus', year: 2020 }],
            },
            directives: null,
          })
        )
      }
      if (url.includes('/api/profile')) {
        return Promise.resolve(
          createResponse({ profile: { phone: '+49111222333', address: 'Testweg 1' } })
        )
      }
      return Promise.resolve(createResponse({}))
    }) as unknown as typeof fetch
  })

  it('generates plain-text payload', async () => {
    const payload = await renderAndCapturePayload()

    expect(payload.startsWith('NOTFALL-INFO')).toBe(true)
    expect(payload).not.toMatch(/^https?:\/\//)
    expect(payload).not.toMatch(/^notes:\/\//)
  })

  it('includes required line prefixes', async () => {
    const payload = await renderAndCapturePayload()

    expect(payload).toContain('Name:')
    expect(payload).toContain('Geburtsdatum:')
    expect(payload).toContain('Notfallkontakt:')
    expect(payload).toContain('Arzt:')
    expect(payload).toContain('Allergien:')
    expect(payload).toContain('Medikationsplan: Stand 15.07.2024')
    expect(payload).toContain('- Ibuprofen 400 mg (Schmerzen)')
    expect(payload).toContain('Impfungen:')
  })

  it('does not include Blutgruppe in QR payload', async () => {
    const payload = await renderAndCapturePayload()

    expect(payload).not.toContain('Blutgruppe')
  })

  describe('summary grid truncation', () => {
    it('caps medications list to 3 entries with +N weitere', async () => {
      global.fetch = vi.fn((input: RequestInfo) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/notfall')) {
          return Promise.resolve(
            createResponse({
              emergencyContacts: [],
              medicalInfo: {
                allergies: [],
                medications: [
                  { wirkstoff: 'Metformin' },
                  { wirkstoff: 'Aspirin' },
                  { wirkstoff: 'Lisinopril' },
                  { wirkstoff: 'Ramipril' },
                  { wirkstoff: 'Amlodipin' },
                  { wirkstoff: 'Simvastatin' },
                  { wirkstoff: 'Pantoprazol' },
                ],
                medication_plan_updated_at: null,
                conditions: [],
                doctor_name: null,
                doctor_phone: null,
                insurance_number: null,
                organ_donor: null,
                vaccinations: [],
              },
              directives: null,
            })
          )
        }
        if (url.includes('/api/profile')) {
          return Promise.resolve(createResponse({ profile: {} }))
        }
        return Promise.resolve(createResponse({}))
      }) as unknown as typeof fetch

      render(<ExportPage />)

      await waitFor(() => {
        const el = screen.getByText(/Medikamente:/)
        expect(el.textContent).toContain('+4 weitere')
        expect(el.textContent).not.toContain('Ramipril')
      })
    })

    it('caps vaccinations list to 3 entries with +N weitere', async () => {
      global.fetch = vi.fn((input: RequestInfo) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/notfall')) {
          return Promise.resolve(
            createResponse({
              emergencyContacts: [],
              medicalInfo: {
                allergies: [],
                medications: [],
                medication_plan_updated_at: null,
                conditions: [],
                doctor_name: null,
                doctor_phone: null,
                insurance_number: null,
                organ_donor: null,
              },
              directives: null,
            })
          )
        }
        if (url.includes('/api/vaccinations')) {
          return Promise.resolve(
            createResponse({
              vaccinations: [
                { name: 'Tetanus', month: null, year: 2020 },
                { name: 'Influenza', month: null, year: 2023 },
                { name: 'Covid-19', month: null, year: 2022 },
                { name: 'Hepatitis B', month: null, year: 2019 },
                { name: 'Masern', month: null, year: 2018 },
              ],
            })
          )
        }
        if (url.includes('/api/profile')) {
          return Promise.resolve(createResponse({ profile: {} }))
        }
        return Promise.resolve(createResponse({}))
      }) as unknown as typeof fetch

      render(<ExportPage />)

      await waitFor(() => {
        const el = screen.getByText(/Impfungen:/)
        expect(el.textContent).toContain('+2 weitere')
        expect(el.textContent).not.toContain('Hepatitis B')
      })
    })
  })

  it('does not include Blutgruppe in generated PDF', async () => {
    mockDocText.mockClear()

    render(<ExportPage />)

    await waitFor(() => {
      expect(screen.getByText('PDF herunterladen')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('PDF herunterladen'))

    await waitFor(() => {
      expect(mockDoc.save).toHaveBeenCalled()
    })

    const allTextCalls = mockDocText.mock.calls.map(([str]: [string]) => str)
    expect(allTextCalls.every((s: string) => !s.includes('Blutgruppe'))).toBe(true)
  })
})
