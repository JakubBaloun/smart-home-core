import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { Device } from '@/modules/devices/types/device'
import { RoomTelemetryWidgets } from './RoomTelemetryWidgets'

class EventSourceStub {
  static instances: EventSourceStub[] = []
  listeners = new Map<string, (event: Event) => void>()

  constructor(_url: string) {
    EventSourceStub.instances.push(this)
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.set(type, listener)
  }

  removeEventListener(type: string) {
    this.listeners.delete(type)
  }

  close() {}

  emitState(data: unknown) {
    this.listeners.get('state')?.({ data: JSON.stringify(data) } as MessageEvent<string>)
  }
}

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

function renderWidgets(devices: Device[]) {
  return render(
    <MemoryRouter>
      <RoomTelemetryWidgets roomId="office" devices={devices} range="24h" />
    </MemoryRouter>,
  )
}

describe('RoomTelemetryWidgets', () => {
  beforeEach(() => {
    EventSourceStub.instances = []
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('EventSource', EventSourceStub)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('shows a climate device as separate temperature and humidity cards and omits diagnostic values', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ deviceName: 'Bedroom temp', values: { temperature: 21.5, humidity: 48, voltage: 14, battery: 90 }, lastUpdated: null }),
    )

    renderWidgets([device()])

    expect(await screen.findByText('21.5°C')).toBeInTheDocument()
    expect(screen.getByText('48%')).toBeInTheDocument()
    expect(screen.getAllByText('Bedroom temp')).toHaveLength(2)
    expect(screen.queryByText('14')).not.toBeInTheDocument()
    expect(screen.queryByText('90')).not.toBeInTheDocument()
  })

  it('toggles temperature and humidity history independently', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ deviceName: 'Bedroom temp', values: { temperature: 21.5, humidity: 48 }, lastUpdated: null }),
    )

    renderWidgets([device()])

    expect(await screen.findByText('21.5°C')).toBeInTheDocument()
    const toggles = screen.getAllByText('Zobrazit historii')
    expect(toggles).toHaveLength(2)

    await userEvent.click(toggles[0])
    expect(screen.getByText('Skrýt historii')).toBeInTheDocument()
    expect(screen.getAllByText('Zobrazit historii')).toHaveLength(1)
  })

  it('gives a contact sensor only its open/closed state', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ deviceName: 'Dveře', values: { contact: 0, voltage: 14 }, lastUpdated: null }),
    )

    renderWidgets([device({ friendlyName: 'Dveře' })])

    expect(await screen.findByText('Otevřeno')).toBeInTheDocument()
    expect(screen.queryByText('14')).not.toBeInTheDocument()
    expect(screen.queryByText('Zobrazit historii')).not.toBeInTheDocument()
  })

  it('renders a controllable device as a single on/off card and sends its command', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      if (String(input) === '/api/devices/2/command') return Promise.resolve(new Response(null, { status: 202 }))
      return Promise.resolve(new Response('not found', { status: 404 }))
    })

    renderWidgets([device({ id: 2, ieeeAddress: '0xbbb', friendlyName: 'Žárovka', type: 'LIGHT', state: 'ON' })])

    expect(await screen.findByText('Zapnuto')).toBeInTheDocument()
    expect(screen.getByText('Vypnout')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Vypnout'))
    expect(screen.getByText('Vypnuto')).toBeInTheDocument()
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/devices/2/command', expect.objectContaining({ method: 'POST' })))
  })

  it('updates a controllable device immediately when Zigbee2MQTT confirms its state', async () => {
    renderWidgets([device({ id: 2, ieeeAddress: '0xbbb', friendlyName: 'Žárovka', type: 'LIGHT', state: 'OFF' })])

    expect(await screen.findByText('Vypnuto')).toBeInTheDocument()
    EventSourceStub.instances[0].emitState({ ieeeAddress: '0xbbb', state: 'ON' })

    expect(await screen.findByText('Zapnuto')).toBeInTheDocument()
  })
})
