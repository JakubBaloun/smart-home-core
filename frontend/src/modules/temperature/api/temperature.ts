import { getDevices } from '@/modules/devices/api/devices'
import { getLatestTelemetry } from '@/modules/devices/api/telemetry'
import type { Device } from '@/modules/devices/types/device'
import type { LatestTelemetryResponse } from '@/modules/devices/types/telemetry'

export interface TemperatureReading {
  device: Device
  latest: LatestTelemetryResponse
}

/** Devices don't carry a "temperature sensor" type, so we probe each one's latest telemetry. */
export async function getTemperatureReadings(): Promise<TemperatureReading[]> {
  const devices = await getDevices()

  const results = await Promise.all(
    devices.map(async (device): Promise<TemperatureReading | null> => {
      try {
        const latest = await getLatestTelemetry(device.ieeeAddress)
        return typeof latest.values.temperature === 'number' ? { device, latest } : null
      } catch {
        return null
      }
    }),
  )

  return results.filter((reading): reading is TemperatureReading => reading !== null)
}
