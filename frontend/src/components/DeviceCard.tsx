import { Link } from 'react-router-dom'
import type { Device } from '../types/device'

const TYPE_ICON: Record<Device['type'], string> = {
  LIGHT: '💡',
  SENSOR: '📡',
  SWITCH: '🔌',
  PLUG: '🔋',
  OTHER: '📦',
}

function formatLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return 'Never seen'
  const diffMs = Date.now() - new Date(lastSeen).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function DeviceCard({ device }: { device: Device }) {
  return (
    <Link
      to={`/device/${device.id}`}
      className="flex min-h-[120px] flex-col justify-between rounded-xl border border-gray-800 bg-gray-900 p-5 transition hover:border-gray-600 hover:bg-gray-800 active:scale-[0.98]"
    >
      <div className="flex items-start justify-between">
        <span className="text-3xl">{TYPE_ICON[device.type]}</span>
        <span
          className={`h-3 w-3 rounded-full ${device.available ? 'bg-emerald-500' : 'bg-gray-600'}`}
          title={device.available ? 'Online' : 'Offline'}
        />
      </div>
      <div>
        <h3 className="truncate text-lg font-medium text-gray-100">{device.friendlyName}</h3>
        <p className="text-sm text-gray-500">
          {device.vendor ?? 'Unknown vendor'} {device.model ?? ''}
        </p>
        <p className="mt-1 text-xs text-gray-600">{formatLastSeen(device.lastSeen)}</p>
      </div>
    </Link>
  )
}
