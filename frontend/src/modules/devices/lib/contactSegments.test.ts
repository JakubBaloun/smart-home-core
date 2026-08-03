import { describe, expect, it } from 'vitest'
import { buildContactSegments, formatDuration } from './contactSegments'
import type { TelemetryPoint } from '../types/telemetry'

const FROM = new Date('2026-08-01T00:00:00Z').getTime()
const TO = new Date('2026-08-01T01:00:00Z').getTime()

function point(iso: string, value: number): TelemetryPoint {
  return { time: iso, value }
}

describe('buildContactSegments', () => {
  it('returns no segments when there are no points', () => {
    expect(buildContactSegments([], FROM, TO)).toEqual([])
  })

  it('returns a single segment spanning the whole range when the state never changes', () => {
    const points = [point('2026-08-01T00:10:00Z', 1), point('2026-08-01T00:40:00Z', 1)]

    expect(buildContactSegments(points, FROM, TO)).toEqual([{ closed: true, startMs: FROM, endMs: TO }])
  })

  it('splits into segments at each observed state change', () => {
    const points = [point('2026-08-01T00:20:00Z', 1), point('2026-08-01T00:40:00Z', 0)]
    const t1 = new Date('2026-08-01T00:40:00Z').getTime()

    expect(buildContactSegments(points, FROM, TO)).toEqual([
      { closed: true, startMs: FROM, endMs: t1 },
      { closed: false, startMs: t1, endMs: TO },
    ])
  })

  it('handles multiple oscillations and covers the full range with no gaps', () => {
    const points = [
      point('2026-08-01T00:10:00Z', 0),
      point('2026-08-01T00:12:00Z', 1),
      point('2026-08-01T00:30:00Z', 0),
      point('2026-08-01T00:31:00Z', 1),
    ]

    const segments = buildContactSegments(points, FROM, TO)

    expect(segments).toHaveLength(4)
    expect(segments[0].startMs).toBe(FROM)
    expect(segments[segments.length - 1].endMs).toBe(TO)
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].startMs).toBe(segments[i - 1].endMs)
    }
  })

  it('treats any non-1 value as open', () => {
    const points = [point('2026-08-01T00:10:00Z', 0)]

    expect(buildContactSegments(points, FROM, TO)).toEqual([{ closed: false, startMs: FROM, endMs: TO }])
  })
})

describe('formatDuration', () => {
  it('formats sub-minute durations in seconds', () => {
    expect(formatDuration(40_000)).toBe('40 s')
  })

  it('formats sub-hour durations in minutes', () => {
    expect(formatDuration(2 * 60_000)).toBe('2 min')
  })

  it('formats hour-plus durations as hours and minutes', () => {
    expect(formatDuration(3 * 60 * 60_000 + 10 * 60_000)).toBe('3 h 10 min')
  })

  it('omits minutes when they round to zero', () => {
    expect(formatDuration(2 * 60 * 60_000)).toBe('2 h')
  })
})
