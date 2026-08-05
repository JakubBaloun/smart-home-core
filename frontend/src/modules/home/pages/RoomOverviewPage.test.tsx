import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomOverviewPage } from './RoomOverviewPage'

const DEVICES_PATH = '/api/devices'

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}

describe('RoomOverviewPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders one card per configured room, including rooms without a sensor', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === DEVICES_PATH) return Promise.resolve(jsonResponse([]))
      return Promise.resolve(new Response('not found', { status: 404 }))
    })

    render(
      <MemoryRouter>
        <RoomOverviewPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('Pracovna')).toBeInTheDocument())
    expect(screen.getByText('Ložnice')).toBeInTheDocument()
    expect(screen.getByText('Kuchyně')).toBeInTheDocument()
    expect(screen.getAllByText('bez senzoru').length).toBeGreaterThan(0)
  })
})
