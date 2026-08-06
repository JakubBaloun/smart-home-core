export interface TelemetryPoint {
  time: string
  value: number
}

export interface TelemetryResponse {
  deviceName: string
  field: string
  points: TelemetryPoint[]
}

export interface LatestTelemetryResponse {
  deviceName: string
  values: Record<string, number>
  lastUpdated: string | null
}

export const KNOWN_TELEMETRY_FIELDS = [
  'temperature',
  'humidity',
  'battery',
  'power',
  'voltage',
  'energy',
  'linkquality',
  'contact',
] as const

export type TelemetryField = (typeof KNOWN_TELEMETRY_FIELDS)[number]

export type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d'
