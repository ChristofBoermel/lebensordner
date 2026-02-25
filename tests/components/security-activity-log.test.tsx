import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SecurityActivityLog } from '@/components/settings/security-activity-log'

const createResponse = (data: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
}) as Response

describe('SecurityActivityLog', () => {
  it('fetches with limit=3', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createResponse({ events: [] }))
    global.fetch = fetchMock as unknown as typeof fetch

    render(<SecurityActivityLog />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })

    const calledUrl = String(fetchMock.mock.calls[0][0])
    expect(calledUrl).toContain('limit=3')
    expect(calledUrl).not.toContain('limit=50')
  })

  it('does not render filter tabs', async () => {
    global.fetch = vi.fn().mockResolvedValue(createResponse({ events: [] })) as unknown as typeof fetch

    render(<SecurityActivityLog />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    expect(screen.queryByText('Anmeldungen')).not.toBeInTheDocument()
    expect(screen.queryByText('Fehlversuche')).not.toBeInTheDocument()
    expect(screen.queryByText('Datenzugriff')).not.toBeInTheDocument()
  })
})
