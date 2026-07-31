import { getDevices } from '@/modules/devices/api/devices'
import { getLatestTelemetry } from '@/modules/devices/api/telemetry'
import { rooms, type RoomConfig } from '../config/rooms'

export interface RoomReading {
  room: RoomConfig
  temperature?: number
  humidity?: number
}

export async function getRoomReadings(): Promise<RoomReading[]> {
  const devices = await getDevices()

  return Promise.all(
    rooms.map(async (room): Promise<RoomReading> => {
      if (!room.sensorFriendlyName) return { room }

      const device = devices.find((d) => d.friendlyName === room.sensorFriendlyName)
      if (!device) return { room }

      try {
        const latest = await getLatestTelemetry(device.ieeeAddress)
        return {
          room,
          temperature: typeof latest.values.temperature === 'number' ? latest.values.temperature : undefined,
          humidity: typeof latest.values.humidity === 'number' ? latest.values.humidity : undefined,
        }
      } catch {
        return { room }
      }
    }),
  )
}
