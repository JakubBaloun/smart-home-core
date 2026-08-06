import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendCommand } from '@/modules/devices/api/devices'
import type { Device } from '@/modules/devices/types/device'
import { RoomStatCards } from './RoomStatCards'

vi.mock('@/modules/devices/api/devices', () => ({
  sendCommand: vi.fn(),
}))

function device(overrides: Partial<Device> = {}): Device {
  return {
    id: 1,
    ieeeAddress: '0xaaa',
    friendlyName: 'Bedroom temp',
    type: 'SENSOR',
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

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}

describe('RoomStatCards', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.mocked(sendCommand).mockClear()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('renders one card per numeric field on a climate sensor', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/latest')) {
        return Promise.resolve(jsonResponse({ deviceName: 'Bedroom temp', values: { temperature: 21.5, humidity: 48 }, lastUpdated: null }))
      }
      return Promise.resolve(jsonResponse({ deviceName: 'Bedroom temp', field: 'temperature', points: [
        { time: '2026-08-06T00:00:00Z', value: 21.0 },
        { time: '2026-08-06T01:00:00Z', value: 21.5 },
      ] }))
    })

    render(
      <MemoryRouter>
        <RoomStatCards devices={[device()]} range="1h" onRefresh={vi.fn()} />
      </MemoryRouter>,
    )

    expect(await screen.findByText('21.5°C')).toBeInTheDocument()
    expect(await screen.findByText('48 %')).toBeInTheDocument()
  })

  it('renders two temperature cards for a room with two temperature sensors', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/telemetry/0xaaa/latest')) {
        return Promise.resolve(jsonResponse({ deviceName: 'A', values: { temperature: 21.5 }, lastUpdated: null }))
      }
      if (url.includes('/api/telemetry/0xbbb/latest')) {
        return Promise.resolve(jsonResponse({ deviceName: 'B', values: { temperature: 19.0 }, lastUpdated: null }))
      }
      return Promise.resolve(jsonResponse({ deviceName: 'x', field: 'temperature', points: [] }))
    })

    render(
      <MemoryRouter>
        <RoomStatCards
          devices={[
            device({ id: 1, ieeeAddress: '0xaaa', friendlyName: 'A' }),
            device({ id: 2, ieeeAddress: '0xbbb', friendlyName: 'B' }),
          ]}
          range="1h"
          onRefresh={vi.fn()}
        />
      </MemoryRouter>,
    )

    expect(await screen.findByText('21.5°C')).toBeInTheDocument()
    expect(await screen.findByText('19.0°C')).toBeInTheDocument()
  })

  it('renders contact chip with Zavřeno/Otevřeno for a door sensor', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/latest')) {
        return Promise.resolve(jsonResponse({ deviceName: 'door', values: { contact: 0 }, lastUpdated: null }))
      }
      return Promise.resolve(jsonResponse({ deviceName: 'door', field: 'contact', points: [] }))
    })

    render(
      <MemoryRouter>
        <RoomStatCards devices={[device({ friendlyName: 'Dveře' })]} range="24h" onRefresh={vi.fn()} />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Otevřeno')).toBeInTheDocument()
  })

  it('renders light card with brightness percent when ON', async () => {
    render(
      <MemoryRouter>
        <RoomStatCards
          devices={[device({ id: 2, ieeeAddress: '0xbbb', friendlyName: 'Lamp', type: 'LIGHT', state: 'ON', brightness: 127 })]}
          range="24h"
          onRefresh={vi.fn()}
        />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Zapnuto')).toBeInTheDocument()
    expect(screen.getByText('50 %')).toBeInTheDocument()
  })

  it('renders light card with no brightness when OFF', async () => {
    render(
      <MemoryRouter>
        <RoomStatCards
          devices={[device({ id: 2, ieeeAddress: '0xbbb', friendlyName: 'Lamp', type: 'LIGHT', state: 'OFF', brightness: 200 })]}
          range="24h"
          onRefresh={vi.fn()}
        />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Vypnuto')).toBeInTheDocument()
    expect(screen.queryByText('%')).toBeNull()
  })

  it('sends setState ON when the toggle is clicked on an OFF light', async () => {
    vi.mocked(sendCommand).mockResolvedValue(undefined)
    const onRefresh = vi.fn()

    render(
      <MemoryRouter>
        <RoomStatCards
          devices={[device({ id: 2, ieeeAddress: '0xbbb', friendlyName: 'Lamp', type: 'LIGHT', state: 'OFF' })]}
          range="24h"
          onRefresh={onRefresh}
        />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('switch'))

    expect(sendCommand).toHaveBeenCalledWith(2, { command: 'setState', payload: { state: 'ON' } })
    await waitFor(() => expect(onRefresh).toHaveBeenCalled())
  })
})
