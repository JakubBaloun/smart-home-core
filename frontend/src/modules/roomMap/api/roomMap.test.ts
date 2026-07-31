import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getRoomReadings } from './roomMap'

const DEVICES_PATH = '/api/devices'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

function mockFetchSequence(devices: unknown[], telemetryByKey: Record<string, unknown>) {
  vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    if (url === DEVICES_PATH) {
      return Promise.resolve(jsonResponse(devices))
    }
    const match = Object.keys(telemetryByKey).find((key) => url === `/api/telemetry/${key}/latest`)
    if (match) {
      const value = telemetryByKey[match]
      if (value === 'ERROR') {
        return Promise.resolve(new Response('boom', { status: 500 }))
      }
      return Promise.resolve(jsonResponse(value))
    }
    return Promise.resolve(new Response('not found', { status: 404 }))
  })
}

describe('getRoomReadings', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('attaches temperature and humidity for a room whose sensor resolves and reports both', async () => {
    mockFetchSequence(
      [{ id: 1, friendlyName: 'Bedroom temp', ieeeAddress: '0xaaa' }],
      { '0xaaa': { deviceName: 'Bedroom temp', values: { temperature: 21.5, humidity: 44 }, lastUpdated: '2026-07-31T10:00:00Z' } },
    )

    const readings = await getRoomReadings()
    const office = readings.find((r) => r.room.id === 'office')!

    expect(office.temperature).toBe(21.5)
    expect(office.humidity).toBe(44)
  })

  it('leaves temperature/humidity undefined for a room with no assigned sensor', async () => {
    mockFetchSequence([], {})

    const readings = await getRoomReadings()
    const livingRoom = readings.find((r) => r.room.id === 'living-room')!

    expect(livingRoom.temperature).toBeUndefined()
    expect(livingRoom.humidity).toBeUndefined()
  })

  it('leaves temperature/humidity undefined when the configured friendlyName matches no device', async () => {
    mockFetchSequence([{ id: 9, friendlyName: 'some_other_device', ieeeAddress: '0xbbb' }], {})

    const readings = await getRoomReadings()
    const office = readings.find((r) => r.room.id === 'office')!

    expect(office.temperature).toBeUndefined()
    expect(office.humidity).toBeUndefined()
  })

  it('leaves temperature/humidity undefined when the telemetry fetch fails', async () => {
    mockFetchSequence(
      [{ id: 1, friendlyName: 'Bedroom temp', ieeeAddress: '0xaaa' }],
      { '0xaaa': 'ERROR' },
    )

    const readings = await getRoomReadings()
    const office = readings.find((r) => r.room.id === 'office')!

    expect(office.temperature).toBeUndefined()
    expect(office.humidity).toBeUndefined()
  })
})
