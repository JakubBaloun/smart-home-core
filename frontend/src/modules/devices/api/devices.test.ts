import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDevice, getDevices, sendCommand } from './devices'
import { ApiError } from '@/api/client'

describe('devices api client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getDevices returns the parsed device list', async () => {
    const devices = [{ id: 1, friendlyName: 'living_room_light' }]
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(devices), { status: 200 }),
    )

    const result = await getDevices()

    expect(fetch).toHaveBeenCalledWith('/api/devices', expect.any(Object))
    expect(result).toEqual(devices)
  })

  it('getDevice fetches a single device by id', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: 42 }), { status: 200 }),
    )

    await getDevice(42)

    expect(fetch).toHaveBeenCalledWith('/api/devices/42', expect.any(Object))
  })

  it('sendCommand posts the command payload', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 202 }))

    await sendCommand(1, { command: 'setState', payload: { state: 'ON' } })

    expect(fetch).toHaveBeenCalledWith(
      '/api/devices/1/command',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ command: 'setState', payload: { state: 'ON' } }),
      }),
    )
  })

  it('throws an ApiError when the response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('device not found', { status: 404 }))

    await expect(getDevice(999)).rejects.toBeInstanceOf(ApiError)
  })
})
