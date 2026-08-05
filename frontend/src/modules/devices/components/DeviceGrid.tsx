import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LiveDot } from '@/ui/LiveDot'
import { IconBulb, IconChevronUp, IconCube, IconPlug, IconSensor, IconSwitch } from '@/ui/icons'
import type { DeviceReading } from '../api/deviceReadings'
import { formatLastSeen } from '../format'
import type { Device } from '../types/device'
import { DeviceCard } from './DeviceCard'

const STAGGER_LIMIT = 12
const STAGGER_STEP_MS = 40

interface Section {
  label: string
  types: Device['type'][]
}

const SECTIONS: Section[] = [
  { label: 'Světla', types: ['LIGHT'] },
  { label: 'Spínače a zásuvky', types: ['SWITCH', 'PLUG'] },
  { label: 'Senzory', types: ['SENSOR'] },
  { label: 'Ostatní', types: ['OTHER'] },
]

const TYPE_ICON = {
  LIGHT: IconBulb,
  SENSOR: IconSensor,
  SWITCH: IconSwitch,
  PLUG: IconPlug,
  OTHER: IconCube,
}

export function DeviceGrid({
  readings,
  variant = 'grid',
  defaultCollapsed = false,
}: {
  readings: DeviceReading[]
  variant?: 'grid' | 'list'
  defaultCollapsed?: boolean
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  if (readings.length === 0) {
    return <p className="text-ink-muted">No devices found.</p>
  }

  const orderedReadings = SECTIONS.flatMap((section) => readings.filter((reading) => section.types.includes(reading.device.type)))

  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="mb-4 flex items-center gap-2 text-sm text-ink-muted hover:text-ink"
      >
        <IconChevronUp className={`size-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        Zařízení ({readings.length})
      </button>

      {!collapsed && (
        variant === 'list' ? (
          <div className="overflow-hidden rounded-2xl border border-line bg-surface-raised">
            {orderedReadings.map(({ device, liveValue }) => <DeviceListRow key={device.id} device={device} liveValue={liveValue} />)}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {SECTIONS.map((section) => {
              const sectionReadings = readings.filter((r) => section.types.includes(r.device.type))
              if (sectionReadings.length === 0) return null

              return (
                <div key={section.label}>
                  <h2 className="mb-3 border-b border-line pb-2 text-xs tracking-wide text-ink-muted uppercase">
                    {section.label}
                  </h2>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {sectionReadings.map(({ device, liveValue }, index) => (
                      <DeviceCard
                        key={device.id}
                        device={device}
                        liveValue={liveValue}
                        style={{ animationDelay: `${Math.min(index, STAGGER_LIMIT) * STAGGER_STEP_MS}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}

function DeviceListRow({ device, liveValue }: DeviceReading) {
  const Icon = TYPE_ICON[device.type]
  return (
    <Link
      to={`/device/${device.id}`}
      className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-overlay"
    >
      <Icon className="size-5 shrink-0 text-ink-muted" />
      <span className="min-w-0 flex-1 truncate font-medium text-ink">{device.friendlyName}</span>
      <span className="hidden truncate text-sm text-ink-muted sm:block">{liveValue ?? formatLastSeen(device.lastSeen)}</span>
      <span title={device.available ? 'Online' : 'Offline'}><LiveDot online={device.available} /></span>
    </Link>
  )
}
