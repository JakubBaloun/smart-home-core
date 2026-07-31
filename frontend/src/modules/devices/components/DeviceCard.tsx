import type { ComponentType, CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { LiveDot } from '@/ui/LiveDot'
import { IconBulb, IconCube, IconPlug, IconSensor, IconSwitch } from '@/ui/icons'
import { formatLastSeen } from '../format'
import type { Device } from '../types/device'

const TYPE_ICON: Record<Device['type'], ComponentType<{ className?: string }>> = {
  LIGHT: IconBulb,
  SENSOR: IconSensor,
  SWITCH: IconSwitch,
  PLUG: IconPlug,
  OTHER: IconCube,
}

export function DeviceCard({
  device,
  liveValue,
  style,
}: {
  device: Device
  liveValue?: string
  style?: CSSProperties
}) {
  const TypeIcon = TYPE_ICON[device.type]

  return (
    <Link
      to={`/device/${device.id}`}
      style={style}
      className="animate-fade-slide-in flex min-h-[120px] flex-col justify-between rounded-2xl border border-line bg-surface-raised p-5 transition hover:-translate-y-0.5 hover:border-line-strong hover:bg-overlay hover:shadow-lg active:scale-[0.98]"
    >
      <div className="flex items-start justify-between">
        <TypeIcon className="size-7 text-ink-muted" />
        <span title={device.available ? 'Online' : 'Offline'}>
          <LiveDot online={device.available} />
        </span>
      </div>
      <div>
        <h3 className="truncate text-lg font-medium text-ink">{device.friendlyName}</h3>
        <p className="truncate text-sm text-ink-muted">
          {device.vendor ?? 'Unknown vendor'} {device.model ?? ''}
        </p>
        {liveValue ? (
          <p className="mt-1 font-mono text-xs text-cool">{liveValue}</p>
        ) : (
          <p className="mt-1 font-mono text-xs text-ink-faint">{formatLastSeen(device.lastSeen)}</p>
        )}
      </div>
    </Link>
  )
}
