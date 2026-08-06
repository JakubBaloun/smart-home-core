import type { TelemetryPoint, TimeRange } from '../types/telemetry'

export function computeDelta(points: TelemetryPoint[]): number | null {
  if (points.length < 2) return null
  const sorted = [...points].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
  return sorted[sorted.length - 1].value - sorted[0].value
}

export function formatSignedDelta(delta: number, unit: string, digits = 1): string {
  const abs = Math.abs(delta).toFixed(digits)
  if (delta > 0) return `+${abs}${unit}`
  if (delta < 0) return `-${abs}${unit}`
  return `${abs}${unit}`
}

export function trendWord(delta: number | null, threshold: number): 'stabilní' | 'stoupá' | 'klesá' {
  if (delta === null || Math.abs(delta) <= threshold) return 'stabilní'
  return delta > 0 ? 'stoupá' : 'klesá'
}

const RANGE_LABELS: Record<TimeRange, string> = {
  '1h': 'za hodinu',
  '6h': 'za 6 hodin',
  '24h': 'za 24 hodin',
  '7d': 'za týden',
  '30d': 'za měsíc',
}

export function rangeLabel(range: TimeRange): string {
  return RANGE_LABELS[range]
}
