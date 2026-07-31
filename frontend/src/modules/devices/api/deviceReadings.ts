import { getDevices } from './devices'
import { getLatestTelemetry } from './telemetry'
import type { Device } from '../types/device'

export interface DeviceReading {
  device: Device
  /** Latest temperature/humidity reading, formatted for inline display. Sensor devices only. */
  liveValue?: string
}

function formatLiveValue(values: Record<string, number>): string | undefined {
  const parts: string[] = []
  if (typeof values.temperature === 'number') parts.push(`${values.temperature.toFixed(1)}°C`)
  if (typeof values.humidity === 'number') parts.push(`${Math.round(values.humidity)}%`)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

/** Devices don't carry a live value by default — sensors get one probed from their latest telemetry. */
export async function getDeviceReadings(): Promise<DeviceReading[]> {
  const devices = await getDevices()

  return Promise.all(
    devices.map(async (device): Promise<DeviceReading> => {
      if (device.type !== 'SENSOR') return { device }

      try {
        const latest = await getLatestTelemetry(device.ieeeAddress)
        return { device, liveValue: formatLiveValue(latest.values) }
      } catch {
        return { device }
      }
    }),
  )
}
