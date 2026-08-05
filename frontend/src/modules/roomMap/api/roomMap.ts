import { getDevices } from '@/modules/devices/api/devices'
import { getLatestTelemetry } from '@/modules/devices/api/telemetry'
import { rooms, type RoomConfig } from '../config/rooms'

export interface RoomReading {
  room: RoomConfig
  temperature?: number
  humidity?: number
  /** true = closed, false = open. */
  contact?: boolean
}

export async function getRoomReadings(): Promise<RoomReading[]> {
  const devices = await getDevices()

  return Promise.all(
    rooms.map(async (room): Promise<RoomReading> => {
      const reading: RoomReading = { room }

      for (const deviceIeeeAddress of room.deviceIeeeAddresses) {
        const device = devices.find((d) => d.ieeeAddress === deviceIeeeAddress)
        if (!device) continue

        try {
          const latest = await getLatestTelemetry(device.ieeeAddress)
          if (typeof latest.values.temperature === 'number') reading.temperature = latest.values.temperature
          if (typeof latest.values.humidity === 'number') reading.humidity = latest.values.humidity
          if (typeof latest.values.contact === 'number') reading.contact = latest.values.contact === 1
        } catch {
          // This sensor failed to resolve — leave whatever the room already has from a sibling sensor.
        }
      }

      return reading
    }),
  )
}
