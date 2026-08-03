import { apiFetch } from '@/api/client'
import type { LatestTelemetryResponse, TelemetryResponse, TimeRange } from '../types/telemetry'

const RANGE_TO_DURATION_MS: Record<TimeRange, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
}

export function getRangeBounds(range: TimeRange, now: Date = new Date()): { from: Date; to: Date } {
  return { from: new Date(now.getTime() - RANGE_TO_DURATION_MS[range]), to: now }
}

/**
 * `deviceKey` should be the device's `ieeeAddress`. It is immutable, so charts
 * survive a rename; the backend maps it to the device's whole history,
 * including points recorded under names it used to have. A friendly name still
 * works, but only for as long as that name is current.
 */
export function getTelemetryHistory(
  deviceKey: string,
  field: string,
  range: TimeRange,
): Promise<TelemetryResponse> {
  const { from, to } = getRangeBounds(range)

  const params = new URLSearchParams({
    field,
    from: from.toISOString(),
    to: to.toISOString(),
  })

  return apiFetch<TelemetryResponse>(`/telemetry/${encodeURIComponent(deviceKey)}?${params}`)
}

export function getLatestTelemetry(deviceKey: string): Promise<LatestTelemetryResponse> {
  return apiFetch<LatestTelemetryResponse>(`/telemetry/${encodeURIComponent(deviceKey)}/latest`)
}
