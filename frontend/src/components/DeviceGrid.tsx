import type { Device } from '../types/device'
import { DeviceCard } from './DeviceCard'

export function DeviceGrid({ devices }: { devices: Device[] }) {
  if (devices.length === 0) {
    return <p className="text-gray-500">No devices found.</p>
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {devices.map((device) => (
        <DeviceCard key={device.id} device={device} />
      ))}
    </div>
  )
}
