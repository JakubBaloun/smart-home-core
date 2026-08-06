import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomDetailPage } from './RoomDetailPage'

const DEVICES_PATH = '/api/devices'

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}

function device(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    ieeeAddress: '0x1',
    friendlyName: 'device',
    type: 'LIGHT',
    vendor: null,
    model: null,
    available: true,
    state: null,
    brightness: null,
    colorTemp: null,
    lastSeen: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function renderRoom(roomId: string) {
  return render(
    <MemoryRouter initialEntries={[`/room/${roomId}`]}>
      <Routes>
        <Route path="/room/:id" element={<RoomDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RoomDetailPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows an empty state for a room with no assigned devices', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === DEVICES_PATH) return Promise.resolve(jsonResponse([]))
      return Promise.resolve(new Response('not found', { status: 404 }))
    })

    renderRoom('living-room')

    expect(
      await screen.findByText('V tomto pokoji nejsou zaregistrovaná žádná zařízení.'),
    ).toBeInTheDocument()
  })

  it('shows a not-found message for an unknown room id', async () => {
    vi.mocked(fetch).mockImplementation(() => Promise.resolve(jsonResponse([])))

    renderRoom('does-not-exist')

    expect(await screen.findByText('Pokoj nenalezen')).toBeInTheDocument()
  })

  it('renders the room device grid and a telemetry section for an assigned sensor', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === DEVICES_PATH) {
        return Promise.resolve(
          jsonResponse([
            device({ id: 1, ieeeAddress: '0xe456acfffe5dc028', friendlyName: 'Office temp', type: 'SENSOR' }),
            device({ id: 2, ieeeAddress: '0x54dce9fffefa56fb', friendlyName: 'Office door', type: 'SENSOR' }),
            device({ id: 3, ieeeAddress: '0xa4c138518ed616e3', friendlyName: 'Office lamp', type: 'LIGHT' }),
          ]),
        )
      }
      if (url === '/api/telemetry/0xe456acfffe5dc028/latest') {
        return Promise.resolve(
          jsonResponse({ deviceName: 'Office temp', values: { temperature: 21.5 }, lastUpdated: '2026-08-05T10:00:00Z' }),
        )
      }
      if (url === '/api/telemetry/0x54dce9fffefa56fb/latest') {
        return Promise.resolve(
          jsonResponse({ deviceName: 'Office door', values: { contact: 1 }, lastUpdated: '2026-08-05T10:00:00Z' }),
        )
      }
      return Promise.resolve(new Response('not found', { status: 404 }))
    })

    renderRoom('office')

    expect((await screen.findAllByText('Office lamp')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('24h')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Zavřeno')).toBeInTheDocument())
    expect(screen.getByText('Vypnuto')).toBeInTheDocument()
  })

  it('renders a 30d button in the range picker', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === DEVICES_PATH) {
        return Promise.resolve(
          jsonResponse([
            device({ id: 1, ieeeAddress: '0xe456acfffe5dc028', friendlyName: 'Office temp', type: 'SENSOR' }),
          ]),
        )
      }
      if (url === '/api/telemetry/0xe456acfffe5dc028/latest') {
        return Promise.resolve(
          jsonResponse({ deviceName: 'Office temp', values: { temperature: 21.5 }, lastUpdated: '2026-08-05T10:00:00Z' }),
        )
      }
      return Promise.resolve(new Response('not found', { status: 404 }))
    })

    renderRoom('office')

    expect(await screen.findByRole('button', { name: '30d' })).toBeInTheDocument()
  })

  it('shows stat cards and history sections instead of the old masonry widgets', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === DEVICES_PATH) {
        return Promise.resolve(
          jsonResponse([
            device({ id: 1, ieeeAddress: '0xe456acfffe5dc028', friendlyName: 'Office temp', type: 'SENSOR' }),
          ]),
        )
      }
      if (url === '/api/telemetry/0xe456acfffe5dc028/latest') {
        return Promise.resolve(
          jsonResponse({ deviceName: 'Office temp', values: { temperature: 22 }, lastUpdated: null }),
        )
      }
      if (url.startsWith('/api/telemetry/0xe456acfffe5dc028?')) {
        return Promise.resolve(jsonResponse({ deviceName: 'Office temp', field: 'temperature', points: [] }))
      }
      return Promise.resolve(new Response('not found', { status: 404 }))
    })

    renderRoom('office')

    expect(await screen.findByText('22.0°C')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 3, name: /Office temp · teplota/ })).toBeInTheDocument()
    expect(screen.queryByText('Zobrazit historii')).toBeNull()
  })
})
