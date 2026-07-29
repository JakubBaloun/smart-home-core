import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { Ring } from '@/ui/Ring'
import { IconBulb, IconCube, IconPlug, IconSensor, IconSwitch } from '@/ui/icons'
import type { Device } from '../types/device'

const TYPE_ICON: Record<Device['type'], ComponentType<{ className?: string }>> = {
  LIGHT: IconBulb,
  SENSOR: IconSensor,
  SWITCH: IconSwitch,
  PLUG: IconPlug,
  OTHER: IconCube,
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
  const TypeIcon = TYPE_ICON[device.type]

  return (
    <Link
      to={`/device/${device.id}`}
      className="flex min-h-[120px] flex-col justify-between rounded-2xl border border-line bg-surface-raised p-5 transition hover:border-line-strong hover:bg-overlay active:scale-[0.98]"
    >
      <div className="flex items-start justify-between">
        <TypeIcon className="size-7 text-ink-muted" />
        <span title={device.available ? 'Online' : 'Offline'}>
          <Ring
            size={16}
            strokeWidth={7}
            className={device.available ? 'text-ok' : 'text-ink-faint'}
          />
        </span>
      </div>
      <div>
        <h3 className="truncate text-lg font-medium text-ink">{device.friendlyName}</h3>
        <p className="truncate text-sm text-ink-muted">
          {device.vendor ?? 'Unknown vendor'} {device.model ?? ''}
        </p>
        <p className="mt-1 font-mono text-xs text-ink-faint">{formatLastSeen(device.lastSeen)}</p>
      </div>
    </Link>
  )
}
