import { apiFetch } from '@/api/client'
import type { LatestTelemetryResponse, TelemetryResponse, TimeRange } from '../types/telemetry'

const RANGE_TO_DURATION_MS: Record<TimeRange, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
}

export function getTelemetryHistory(
  deviceName: string,
  field: string,
  range: TimeRange,
): Promise<TelemetryResponse> {
  const to = new Date()
  const from = new Date(to.getTime() - RANGE_TO_DURATION_MS[range])

  const params = new URLSearchParams({
    field,
    from: from.toISOString(),
    to: to.toISOString(),
  })

  return apiFetch<TelemetryResponse>(`/telemetry/${encodeURIComponent(deviceName)}?${params}`)
}

export function getLatestTelemetry(deviceName: string): Promise<LatestTelemetryResponse> {
  return apiFetch<LatestTelemetryResponse>(`/telemetry/${encodeURIComponent(deviceName)}/latest`)
}
