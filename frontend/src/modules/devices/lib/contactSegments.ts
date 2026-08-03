import type { TelemetryPoint } from '../types/telemetry'

export interface ContactSegment {
  /** true = closed, false = open. */
  closed: boolean
  startMs: number
  endMs: number
}

function isClosed(value: number): boolean {
  return value === 1
}

/**
 * Builds contiguous closed/open segments spanning [fromMs, toMs]. The state
 * before the first observed point is assumed to equal that point's value —
 * there is no earlier data to know otherwise.
 */
export function buildContactSegments(points: TelemetryPoint[], fromMs: number, toMs: number): ContactSegment[] {
  if (points.length === 0) return []

  const sorted = [...points].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
  const segments: ContactSegment[] = []
  let currentState = isClosed(sorted[0].value)
  let segmentStart = fromMs

  for (const p of sorted) {
    const t = new Date(p.time).getTime()
    const state = isClosed(p.value)
    if (t <= segmentStart) {
      currentState = state
      continue
    }
    if (state !== currentState) {
      segments.push({ closed: currentState, startMs: segmentStart, endMs: t })
      segmentStart = t
      currentState = state
    }
  }

  segments.push({ closed: currentState, startMs: segmentStart, endMs: toMs })
  return segments
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds} s`

  const totalMinutes = Math.round(totalSeconds / 60)
  if (totalMinutes < 60) return `${totalMinutes} min`

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`
}
