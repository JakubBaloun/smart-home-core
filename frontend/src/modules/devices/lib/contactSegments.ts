import type { TelemetryPoint } from '../types/telemetry'

export interface StateSegment {
  active: boolean
  startMs: number
  endMs: number
}

export interface ContactSegment {
  /** true = closed, false = open. Kept for callers that predate buildStateSegments. */
  closed: boolean
  startMs: number
  endMs: number
}

interface BuildStateSegmentsOptions {
  isActive: (value: number) => boolean
}

/**
 * Builds contiguous active/inactive segments spanning [fromMs, toMs]. The state
 * before the first observed point is assumed to equal that point's value —
 * there is no earlier data to know otherwise.
 */
export function buildStateSegments(
  points: TelemetryPoint[],
  fromMs: number,
  toMs: number,
  { isActive }: BuildStateSegmentsOptions,
): StateSegment[] {
  if (points.length === 0) return []

  const sorted = [...points].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
  const segments: StateSegment[] = []
  let currentState = isActive(sorted[0].value)
  let segmentStart = fromMs

  for (const p of sorted) {
    const t = new Date(p.time).getTime()
    const state = isActive(p.value)
    if (t <= segmentStart) {
      currentState = state
      continue
    }
    if (state !== currentState) {
      segments.push({ active: currentState, startMs: segmentStart, endMs: t })
      segmentStart = t
      currentState = state
    }
  }

  segments.push({ active: currentState, startMs: segmentStart, endMs: toMs })
  return segments
}

export function buildContactSegments(
  points: TelemetryPoint[],
  fromMs: number,
  toMs: number,
): ContactSegment[] {
  return buildStateSegments(points, fromMs, toMs, { isActive: (v) => v === 1 }).map((s) => ({
    closed: s.active,
    startMs: s.startMs,
    endMs: s.endMs,
  }))
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
