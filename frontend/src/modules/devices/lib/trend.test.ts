import { describe, expect, it } from 'vitest'
import { computeDelta, formatSignedDelta, rangeLabel, trendWord } from './trend'
import type { TelemetryPoint } from '../types/telemetry'

function p(iso: string, value: number): TelemetryPoint {
  return { time: iso, value }
}

describe('computeDelta', () => {
  it('returns null for fewer than two points', () => {
    expect(computeDelta([])).toBeNull()
    expect(computeDelta([p('2026-08-01T00:00:00Z', 20)])).toBeNull()
  })

  it('returns last minus first across chronologically-sorted points', () => {
    const points = [p('2026-08-01T00:00:00Z', 20), p('2026-08-01T01:00:00Z', 20.6)]
    expect(computeDelta(points)).toBeCloseTo(0.6, 5)
  })

  it('sorts by time before computing', () => {
    const points = [p('2026-08-01T01:00:00Z', 20.6), p('2026-08-01T00:00:00Z', 20)]
    expect(computeDelta(points)).toBeCloseTo(0.6, 5)
  })
})

describe('formatSignedDelta', () => {
  it('prefixes + for positive values', () => {
    expect(formatSignedDelta(0.6, '°', 1)).toBe('+0.6°')
  })

  it('shows − for negative values', () => {
    expect(formatSignedDelta(-1.2, '°', 1)).toBe('-1.2°')
  })

  it('shows 0 without a sign', () => {
    expect(formatSignedDelta(0, '°', 1)).toBe('0.0°')
  })
})

describe('trendWord', () => {
  it('is stabilní for null or below threshold', () => {
    expect(trendWord(null, 2)).toBe('stabilní')
    expect(trendWord(1.5, 2)).toBe('stabilní')
    expect(trendWord(-1.5, 2)).toBe('stabilní')
  })

  it('is stoupá when delta exceeds threshold', () => {
    expect(trendWord(3, 2)).toBe('stoupá')
  })

  it('is klesá when delta is below negative threshold', () => {
    expect(trendWord(-3, 2)).toBe('klesá')
  })
})

describe('rangeLabel', () => {
  it('maps each range to its Czech phrase', () => {
    expect(rangeLabel('1h')).toBe('za hodinu')
    expect(rangeLabel('6h')).toBe('za 6 hodin')
    expect(rangeLabel('24h')).toBe('za 24 hodin')
    expect(rangeLabel('7d')).toBe('za týden')
    expect(rangeLabel('30d')).toBe('za měsíc')
  })
})
