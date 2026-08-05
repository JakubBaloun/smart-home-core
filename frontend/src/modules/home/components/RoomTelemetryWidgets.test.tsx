import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Device } from '@/modules/devices/types/device'
import { RoomTelemetryWidgets, shouldShowWidgetGraph } from './RoomTelemetryWidgets'

function device(overrides: Partial<Device> = {}): Device {
  return {
    id: 1,
    ieeeAddress: '0xaaa',
    friendlyName: 'Office temp',
    type: 'SENSOR',
    vendor: null,
    model: null,
    available: true,
    state: null,
    lastSeen: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}

describe('RoomTelemetryWidgets', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('renders a value widget per non-diagnostic telemetry field', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      if (String(input) === '/api/telemetry/0xaaa/latest') {
        return Promise.resolve(jsonResponse({ deviceName: 'Office temp', values: { temperature: 21.5, battery: 90 }, lastUpdated: null }))
      }
      return Promise.resolve(new Response('not found', { status: 404 }))
    })

    render(<RoomTelemetryWidgets roomId="office" devices={[device()]} range="24h" />)

    expect(await screen.findByText('21.5°C')).toBeInTheDocument()
    expect(screen.queryByText('90')).not.toBeInTheDocument()
  })

  it('shows a graph only once both layout size thresholds are reached', () => {
    expect(shouldShowWidgetGraph({ w: 3, h: 3 })).toBe(false)
    expect(shouldShowWidgetGraph({ w: 4, h: 2 })).toBe(false)
    expect(shouldShowWidgetGraph({ w: 4, h: 3 })).toBe(true)
  })

  it('renders a state widget and sends its toggle command', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/telemetry/0xbbb/latest') return Promise.resolve(new Response('not found', { status: 404 }))
      if (url === '/api/devices/2/command') return Promise.resolve(new Response(null, { status: 202 }))
      return Promise.resolve(new Response('not found', { status: 404 }))
    })

    render(<RoomTelemetryWidgets roomId="office" devices={[device({ id: 2, ieeeAddress: '0xbbb', friendlyName: 'Office lamp', type: 'LIGHT', state: 'OFF' })]} range="24h" />)

    await userEvent.click(await screen.findByText('Vypnuto'))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/devices/2/command', expect.objectContaining({ method: 'POST' })))
  })

  it('shows a fallback message when there are no telemetry or controllable devices', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('not found', { status: 404 }))
    render(<RoomTelemetryWidgets roomId="office" devices={[device({ type: 'OTHER' })]} range="24h" />)

    expect(await screen.findByText('Žádná data k zobrazení.')).toBeInTheDocument()
  })
})
