import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomDeviceTelemetry } from './RoomDeviceTelemetry'
import type { Device } from '@/modules/devices/types/device'

function device(overrides: Partial<Device> = {}): Device {
  return {
    id: 1,
    ieeeAddress: '0xaaa',
    friendlyName: 'Office temp',
    type: 'SENSOR',
    vendor: null,
    model: null,
    available: true,
    lastSeen: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}

describe('RoomDeviceTelemetry', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders nothing for a device with no telemetry fields', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ deviceName: 'Office temp', values: {}, lastUpdated: null }),
    )

    const { container } = render(<RoomDeviceTelemetry device={device()} range="24h" />)

    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the device name and a contact badge for a device reporting contact', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ deviceName: 'Office door', values: { contact: 1 }, lastUpdated: '2026-08-05T10:00:00Z' }),
    )

    render(<RoomDeviceTelemetry device={device({ friendlyName: 'Office door' })} range="24h" />)

    expect(await screen.findByText('Office door')).toBeInTheDocument()
    expect(screen.getByText('zavřeno')).toBeInTheDocument()
  })

  it('shows a field chart heading for a device reporting a non-contact field', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ deviceName: 'Office temp', values: { temperature: 21.5 }, lastUpdated: '2026-08-05T10:00:00Z' }),
    )

    render(<RoomDeviceTelemetry device={device()} range="24h" />)

    expect(await screen.findByText('Office temp')).toBeInTheDocument()
    expect(screen.getByText('temperature')).toBeInTheDocument()
  })
})
