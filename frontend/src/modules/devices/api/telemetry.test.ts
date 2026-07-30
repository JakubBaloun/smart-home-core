import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getLatestTelemetry, getTelemetryHistory } from './telemetry'

const IEEE = '0x00124b0022ab1234'

function requestedPath(): string {
  return vi.mocked(fetch).mock.calls[0][0] as string
}

describe('telemetry api client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ deviceName: 'x', field: 'temperature', points: [] }), {
        status: 200,
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keys history on the identifier it is given, verbatim', async () => {
    await getTelemetryHistory(IEEE, 'temperature', '24h')

    expect(requestedPath()).toContain(`/api/telemetry/${IEEE}?`)
    expect(requestedPath()).toContain('field=temperature')
  })

  it('keys latest on the identifier it is given', async () => {
    await getLatestTelemetry(IEEE)

    expect(requestedPath()).toBe(`/api/telemetry/${IEEE}/latest`)
  })

  it('encodes identifiers containing colons, as ieee addresses may', async () => {
    await getLatestTelemetry('00:11:22:33')

    expect(requestedPath()).toBe('/api/telemetry/00%3A11%3A22%3A33/latest')
  })

  it('sends a from/to window matching the requested range', async () => {
    await getTelemetryHistory(IEEE, 'temperature', '1h')

    const params = new URLSearchParams(requestedPath().split('?')[1])
    const spanMs = new Date(params.get('to')!).getTime() - new Date(params.get('from')!).getTime()
    expect(spanMs).toBe(60 * 60 * 1000)
  })
})
