import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Device } from '@/modules/devices/types/device'
import { RoomHistorySections } from './RoomHistorySections'

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

describe('RoomHistorySections', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('emits temperature, humidity, contact, and light sections in that order', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/telemetry/0xaaa/latest')) {
        return Promise.resolve(jsonResponse({ deviceName: 'Temp+Hum', values: { temperature: 20, humidity: 45 }, lastUpdated: null }))
      }
      if (url.includes('/api/telemetry/0xbbb/latest')) {
        return Promise.resolve(jsonResponse({ deviceName: 'Door', values: { contact: 1 }, lastUpdated: null }))
      }
      if (url.includes('/api/telemetry/0xccc/latest')) {
        return Promise.resolve(jsonResponse({ deviceName: 'Lamp', values: { state: 1 }, lastUpdated: null }))
      }
      return Promise.resolve(jsonResponse({ deviceName: 'x', field: 'x', points: [] }))
    })

    render(
      <RoomHistorySections
        devices={[
          device({ id: 1, ieeeAddress: '0xaaa', friendlyName: 'Temp+Hum' }),
          device({ id: 2, ieeeAddress: '0xbbb', friendlyName: 'Door' }),
          device({ id: 3, ieeeAddress: '0xccc', friendlyName: 'Lamp', type: 'LIGHT' }),
        ]}
        range="24h"
      />,
    )

    await waitFor(() => expect(screen.getAllByRole('heading', { level: 3 }).length).toBeGreaterThanOrEqual(4))
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    const tempIndex = headings.findIndex((t) => t?.includes('Temp+Hum · teplota'))
    const humIndex = headings.findIndex((t) => t?.includes('Temp+Hum · vlhkost'))
    const contactIndex = headings.findIndex((t) => t?.includes('Door'))
    const lampIndex = headings.findIndex((t) => t?.includes('Lamp'))
    expect(tempIndex).toBeGreaterThanOrEqual(0)
    expect(humIndex).toBeGreaterThan(tempIndex)
    expect(contactIndex).toBeGreaterThan(humIndex)
    expect(lampIndex).toBeGreaterThan(contactIndex)
  })

  it('omits a section for a sensor with no matching field', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/telemetry/0xaaa/latest')) {
        return Promise.resolve(jsonResponse({ deviceName: 'Temp only', values: { temperature: 20 }, lastUpdated: null }))
      }
      return Promise.resolve(jsonResponse({ deviceName: 'x', field: 'x', points: [] }))
    })

    render(
      <RoomHistorySections
        devices={[device({ id: 1, ieeeAddress: '0xaaa', friendlyName: 'Temp only' })]}
        range="24h"
      />,
    )

    await waitFor(() => expect(screen.getAllByRole('heading', { level: 3 }).length).toBeGreaterThanOrEqual(1))
    expect(screen.queryByText(/vlhkost/)).toBeNull()
    expect(screen.queryByText(/kontakt/)).toBeNull()
  })

  it('omits the state section for a light/switch/plug with no state telemetry yet', async () => {
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(jsonResponse({ deviceName: 'x', field: 'x', points: [] })),
    )

    render(
      <RoomHistorySections
        devices={[
          device({ id: 1, ieeeAddress: '0xaaa', friendlyName: 'New lamp', type: 'LIGHT' }),
          device({ id: 2, ieeeAddress: '0xbbb', friendlyName: 'New switch', type: 'SWITCH' }),
          device({ id: 3, ieeeAddress: '0xccc', friendlyName: 'New plug', type: 'PLUG' }),
        ]}
        range="24h"
      />,
    )

    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled())
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
    expect(screen.queryByText(/stav/)).toBeNull()
  })
})
