import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSupabaseMock } from '../mocks/supabase-client'

const mockRequireAuth = vi.fn()

let mockAuthUser: { id: string; email: string } | null = {
  id: 'test-user-id',
  email: 'owner@example.com',
}

const { client: supabaseMockClient, thenFn, single } = createSupabaseMock()

vi.mock('@/lib/auth/guards', () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => Promise.resolve(supabaseMockClient)),
}))

describe('Vaccinations API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthUser = { id: 'test-user-id', email: 'owner@example.com' }
    mockRequireAuth.mockImplementation(async () => {
      if (!mockAuthUser) {
        const error: any = new Error('Unauthorized')
        error.statusCode = 401
        throw error
      }
      return { user: mockAuthUser }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/vaccinations', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuthUser = null
      vi.resetModules()
      const { GET } = await import('@/app/api/vaccinations/route')

      const response = await GET()

      expect(response.status).toBe(401)
    })

    it('returns existing rows when user has vaccinations', async () => {
      thenFn.mockImplementationOnce((onFulfilled: any) =>
        Promise.resolve({
          data: [
            {
              id: 'vac-1',
              user_id: 'test-user-id',
              name: 'Tetanus',
              is_standard: true,
              month: null,
              year: null,
            },
          ],
          error: null,
        }).then(onFulfilled)
      )
      vi.resetModules()
      const { GET } = await import('@/app/api/vaccinations/route')

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.vaccinations).toHaveLength(1)
    })

    it('seeds 10 standard rows and returns them when user has none', async () => {
      const seededRows = [
        { id: 'vac-1', user_id: 'test-user-id', name: 'Tetanus', is_standard: true, month: null, year: null },
        { id: 'vac-2', user_id: 'test-user-id', name: 'Diphtherie', is_standard: true, month: null, year: null },
        { id: 'vac-3', user_id: 'test-user-id', name: 'Pertussis (Keuchhusten)', is_standard: true, month: null, year: null },
        { id: 'vac-4', user_id: 'test-user-id', name: 'Masern', is_standard: true, month: null, year: null },
        { id: 'vac-5', user_id: 'test-user-id', name: 'Mumps', is_standard: true, month: null, year: null },
        { id: 'vac-6', user_id: 'test-user-id', name: 'Röteln', is_standard: true, month: null, year: null },
        { id: 'vac-7', user_id: 'test-user-id', name: 'Influenza', is_standard: true, month: null, year: null },
        { id: 'vac-8', user_id: 'test-user-id', name: 'COVID-19', is_standard: true, month: null, year: null },
        { id: 'vac-9', user_id: 'test-user-id', name: 'Hepatitis B', is_standard: true, month: null, year: null },
        { id: 'vac-10', user_id: 'test-user-id', name: 'FSME (Frühsommer-Meningoenzephalitis)', is_standard: true, month: null, year: null },
      ]

      thenFn
        .mockImplementationOnce((onFulfilled: any) => Promise.resolve({ data: [], error: null }).then(onFulfilled))
        .mockImplementationOnce((onFulfilled: any) => Promise.resolve({ data: null, error: null }).then(onFulfilled))
        .mockImplementationOnce((onFulfilled: any) => Promise.resolve({ data: seededRows, error: null }).then(onFulfilled))

      vi.resetModules()
      const { GET } = await import('@/app/api/vaccinations/route')

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.vaccinations).toHaveLength(10)
    })
  })

  describe('POST /api/vaccinations', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuthUser = null
      vi.resetModules()
      const { POST } = await import('@/app/api/vaccinations/route')

      const response = await POST(
        new Request('http://localhost/api/vaccinations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Tetanus', month: 1, year: 2023 }),
        })
      )

      expect(response.status).toBe(401)
    })

    it('returns 400 when year is missing', async () => {
      vi.resetModules()
      const { POST } = await import('@/app/api/vaccinations/route')

      const response = await POST(
        new Request('http://localhost/api/vaccinations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Tetanus', month: 1 }),
        })
      )

      expect(response.status).toBe(400)
    })

    it('returns 400 when month is out of range', async () => {
      vi.resetModules()
      const { POST } = await import('@/app/api/vaccinations/route')

      const response = await POST(
        new Request('http://localhost/api/vaccinations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Tetanus', month: 13, year: 2023 }),
        })
      )

      expect(response.status).toBe(400)
    })

    it('returns 400 when year is out of range', async () => {
      vi.resetModules()
      const { POST } = await import('@/app/api/vaccinations/route')

      const response = await POST(
        new Request('http://localhost/api/vaccinations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Tetanus', month: 1, year: 1800 }),
        })
      )

      expect(response.status).toBe(400)
    })

    it('returns 201 with vaccination on valid input', async () => {
      single.mockResolvedValueOnce({
        data: {
          id: 'vac-1',
          user_id: 'test-user-id',
          name: 'Tetanus',
          is_standard: false,
          month: 1,
          year: 2023,
        },
        error: null,
      })

      vi.resetModules()
      const { POST } = await import('@/app/api/vaccinations/route')

      const response = await POST(
        new Request('http://localhost/api/vaccinations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Tetanus', month: 1, year: 2023 }),
        })
      )
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.vaccination?.id).toBe('vac-1')
    })
  })

  describe('PUT /api/vaccinations/[id]', () => {
    it('returns 403 when row belongs to different user', async () => {
      single.mockResolvedValueOnce({
        data: { id: 'vac-1', user_id: 'other-user-id' },
        error: null,
      })
      vi.resetModules()
      const { PUT } = await import('@/app/api/vaccinations/[id]/route')

      const response = await PUT(
        new Request('http://localhost/api/vaccinations/vac-1', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Tetanus', month: 1, year: 2023 }),
        }),
        { params: Promise.resolve({ id: 'vac-1' }) }
      )

      expect(response.status).toBe(403)
    })

    it('returns 200 on successful update by owner', async () => {
      single.mockResolvedValueOnce({
        data: { id: 'vac-1', user_id: 'test-user-id' },
        error: null,
      })
      thenFn.mockImplementationOnce((onFulfilled: any) => Promise.resolve({ data: null, error: null }).then(onFulfilled))
      vi.resetModules()
      const { PUT } = await import('@/app/api/vaccinations/[id]/route')

      const response = await PUT(
        new Request('http://localhost/api/vaccinations/vac-1', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Tetanus', month: 1, year: 2023 }),
        }),
        { params: Promise.resolve({ id: 'vac-1' }) }
      )

      expect(response.status).toBe(200)
    })
  })

  describe('DELETE /api/vaccinations/[id]', () => {
    it('returns 403 when row belongs to different user', async () => {
      single.mockResolvedValueOnce({
        data: { id: 'vac-1', user_id: 'other-user-id' },
        error: null,
      })
      vi.resetModules()
      const { DELETE } = await import('@/app/api/vaccinations/[id]/route')

      const response = await DELETE(
        new Request('http://localhost/api/vaccinations/vac-1', {
          method: 'DELETE',
        }),
        { params: Promise.resolve({ id: 'vac-1' }) }
      )

      expect(response.status).toBe(403)
    })

    it('returns 200 on successful delete by owner', async () => {
      single.mockResolvedValueOnce({
        data: { id: 'vac-1', user_id: 'test-user-id' },
        error: null,
      })
      thenFn.mockImplementationOnce((onFulfilled: any) => Promise.resolve({ data: null, error: null }).then(onFulfilled))
      vi.resetModules()
      const { DELETE } = await import('@/app/api/vaccinations/[id]/route')

      const response = await DELETE(
        new Request('http://localhost/api/vaccinations/vac-1', {
          method: 'DELETE',
        }),
        { params: Promise.resolve({ id: 'vac-1' }) }
      )

      expect(response.status).toBe(200)
    })
  })
})
