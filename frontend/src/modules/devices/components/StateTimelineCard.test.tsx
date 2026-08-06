import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StateTimelineCard } from './StateTimelineCard'

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}

describe('StateTimelineCard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('renders the state field header and Czech labels for an ON light', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        deviceName: 'lamp',
        field: 'state',
        points: [{ time: '2026-08-01T00:10:00Z', value: 1 }],
      }),
    )

    render(<StateTimelineCard deviceKey="0xaaa" range="24h" currentValue={1} />)

    expect(await screen.findByText('state')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('zapnuto')).toBeInTheDocument())
  })

  it('queries the state field from the telemetry endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ deviceName: 'lamp', field: 'state', points: [] }),
    )

    render(<StateTimelineCard deviceKey="0xaaa" range="24h" />)

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/telemetry/0xaaa?field=state'),
        expect.anything(),
      ),
    )
  })
})
