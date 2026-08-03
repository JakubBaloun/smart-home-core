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
      [{ id: 1, friendlyName: 'Bedroom temp', ieeeAddress: '0xe456acfffe5dc028' }],
      { '0xe456acfffe5dc028': { deviceName: 'Bedroom temp', values: { temperature: 21.5, humidity: 44 }, lastUpdated: '2026-07-31T10:00:00Z' } },
    )

    const readings = await getRoomReadings()
    const office = readings.find((r) => r.room.id === 'office')!

    expect(office.temperature).toBe(21.5)
    expect(office.humidity).toBe(44)
  })

  it('merges readings from a second assigned sensor in the same room', async () => {
    mockFetchSequence(
      [
        { id: 1, friendlyName: 'Bedroom temp', ieeeAddress: '0xe456acfffe5dc028' },
        { id: 2, friendlyName: 'Dveře', ieeeAddress: '0x54dce9fffefa56fb' },
      ],
      {
        '0xe456acfffe5dc028': { deviceName: 'Bedroom temp', values: { temperature: 21.5, humidity: 44 }, lastUpdated: '2026-07-31T10:00:00Z' },
        '0x54dce9fffefa56fb': { deviceName: 'Dveře', values: { contact: 1, battery: 100, linkquality: 60 }, lastUpdated: '2026-07-31T10:00:00Z' },
      },
    )

    const readings = await getRoomReadings()
    const office = readings.find((r) => r.room.id === 'office')!

    expect(office.temperature).toBe(21.5)
    expect(office.humidity).toBe(44)
    expect(office.contact).toBe(true)
  })

  it('maps a contact value of 0 to open (false)', async () => {
    mockFetchSequence(
      [{ id: 2, friendlyName: 'Dveře', ieeeAddress: '0x54dce9fffefa56fb' }],
      { '0x54dce9fffefa56fb': { deviceName: 'Dveře', values: { contact: 0 }, lastUpdated: '2026-07-31T10:00:00Z' } },
    )

    const readings = await getRoomReadings()
    const office = readings.find((r) => r.room.id === 'office')!

    expect(office.contact).toBe(false)
  })

  it('leaves temperature/humidity/contact undefined for a room with no assigned sensors', async () => {
    mockFetchSequence([], {})

    const readings = await getRoomReadings()
    const livingRoom = readings.find((r) => r.room.id === 'living-room')!

    expect(livingRoom.temperature).toBeUndefined()
    expect(livingRoom.humidity).toBeUndefined()
    expect(livingRoom.contact).toBeUndefined()
  })

  it('leaves fields undefined when a configured ieeeAddress matches no device', async () => {
    mockFetchSequence([{ id: 9, friendlyName: 'some_other_device', ieeeAddress: '0xccc' }], {})

    const readings = await getRoomReadings()
    const office = readings.find((r) => r.room.id === 'office')!

    expect(office.temperature).toBeUndefined()
    expect(office.contact).toBeUndefined()
  })

  it('keeps data from a sensor that resolved when a sibling sensor in the same room fails', async () => {
    mockFetchSequence(
      [
        { id: 1, friendlyName: 'Bedroom temp', ieeeAddress: '0xe456acfffe5dc028' },
        { id: 2, friendlyName: 'Dveře', ieeeAddress: '0x54dce9fffefa56fb' },
      ],
      {
        '0xe456acfffe5dc028': { deviceName: 'Bedroom temp', values: { temperature: 21.5 }, lastUpdated: '2026-07-31T10:00:00Z' },
        '0x54dce9fffefa56fb': 'ERROR',
      },
    )

    const readings = await getRoomReadings()
    const office = readings.find((r) => r.room.id === 'office')!

    expect(office.temperature).toBe(21.5)
    expect(office.contact).toBeUndefined()
  })
})
