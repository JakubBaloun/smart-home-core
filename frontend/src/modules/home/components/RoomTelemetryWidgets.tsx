import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { usePolling } from '@/hooks/usePolling'
import { sendCommand } from '@/modules/devices/api/devices'
import { getLatestTelemetry } from '@/modules/devices/api/telemetry'
import { TelemetryFieldChart } from '@/modules/devices/components/TelemetryFieldChart'
import type { Device } from '@/modules/devices/types/device'
import type { TimeRange } from '@/modules/devices/types/telemetry'
import { Button } from '@/ui/Button'
import { LiveDot } from '@/ui/LiveDot'
import { IconBulb, IconCube, IconPlug, IconSensor, IconSwitch } from '@/ui/icons'

const REFRESH_INTERVAL_MS = 15_000
const CONTROLLABLE_TYPES = new Set<Device['type']>(['LIGHT', 'SWITCH', 'PLUG'])

const TYPE_ICON: Record<Device['type'], ComponentType<{ className?: string }>> = {
  LIGHT: IconBulb,
  SENSOR: IconSensor,
  SWITCH: IconSwitch,
  PLUG: IconPlug,
  OTHER: IconCube,
}

interface SensorValues {
  temperature?: number
  humidity?: number
  contact?: number
}

interface RoomDeviceSummary {
  device: Device
  values?: SensorValues
}

async function getRoomDeviceSummaries(devices: Device[]): Promise<RoomDeviceSummary[]> {
  return Promise.all(
    devices.map(async (device) => {
      if (device.type !== 'SENSOR') return { device }

      try {
        const latest = await getLatestTelemetry(device.ieeeAddress)
        const values: SensorValues = {}
        if (typeof latest.values.contact === 'number') values.contact = latest.values.contact
        if (typeof latest.values.temperature === 'number') values.temperature = latest.values.temperature
        if (typeof latest.values.humidity === 'number') values.humidity = latest.values.humidity
        return { device, values }
      } catch {
        return { device }
      }
    }),
  )
}

export function RoomTelemetryWidgets({ devices, range }: { roomId: string; devices: Device[]; range: TimeRange }) {
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const deviceKeys = devices.map((device) => device.ieeeAddress).join(',')
  const { data: summaries } = usePolling(
    () => getRoomDeviceSummaries(devices),
    REFRESH_INTERVAL_MS,
    [deviceKeys],
  )

  const handleToggle = async (device: Device) => {
    setTogglingId(device.id)
    try {
      await sendCommand(device.id, {
        command: 'setState',
        payload: { state: device.state === 'ON' ? 'OFF' : 'ON' },
      })
    } finally {
      setTogglingId(null)
    }
  }

  const visibleSummaries = (summaries ?? []).filter(({ device, values }) =>
    CONTROLLABLE_TYPES.has(device.type) || values?.contact !== undefined || values?.temperature !== undefined || values?.humidity !== undefined,
  )

  if (summaries && visibleSummaries.length === 0) {
    return <p className="text-ink-muted">Žádná data k zobrazení.</p>
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visibleSummaries.map(({ device, values }) => {
        if (CONTROLLABLE_TYPES.has(device.type)) {
          return (
            <ControlCard
              key={device.id}
              device={device}
              toggling={togglingId === device.id}
              onToggle={() => handleToggle(device)}
            />
          )
        }

        if (values?.contact !== undefined) return <ContactCard key={device.id} device={device} contact={values.contact} />

        return <ClimateCard key={device.id} device={device} values={values ?? {}} range={range} />
      })}
    </div>
  )
}

function CardHeader({ device }: { device: Device }) {
  const Icon = TYPE_ICON[device.type]
  return (
    <div className="flex items-start justify-between gap-3">
      <Link to={`/device/${device.id}`} className="flex min-w-0 items-center gap-3 hover:text-accent">
        <Icon className="size-5 shrink-0 text-ink-muted" />
        <h3 className="truncate text-base font-medium text-ink">{device.friendlyName}</h3>
      </Link>
      <span title={device.available ? 'Online' : 'Offline'}>
        <LiveDot online={device.available} />
      </span>
    </div>
  )
}

function ControlCard({ device, toggling, onToggle }: { device: Device; toggling: boolean; onToggle: () => void }) {
  const isOn = device.state === 'ON'
  return (
    <section className="flex min-h-48 flex-col justify-between rounded-2xl border border-line bg-surface-raised p-5">
      <CardHeader device={device} />
      <div className="mt-8">
        <p className={`font-mono text-3xl font-semibold ${isOn ? 'text-warm' : 'text-ink-muted'}`}>
          {isOn ? 'Zapnuto' : 'Vypnuto'}
        </p>
        <p className="mt-1 text-sm text-ink-muted">{device.state === null ? 'Stav se načte po další zprávě zařízení.' : 'Aktuální stav zařízení'}</p>
      </div>
      <Button variant={isOn ? 'neutral' : 'primary'} className="mt-6 w-full" disabled={toggling} onClick={onToggle}>
        {isOn ? 'Vypnout' : 'Zapnout'}
      </Button>
    </section>
  )
}

function ContactCard({ device, contact }: { device: Device; contact: number }) {
  const isClosed = contact === 1
  return (
    <section className="flex min-h-48 flex-col justify-between rounded-2xl border border-line bg-surface-raised p-5">
      <CardHeader device={device} />
      <div className="mt-8">
        <p className={`font-mono text-3xl font-semibold ${isClosed ? 'text-ok' : 'text-danger'}`}>
          {isClosed ? 'Zavřeno' : 'Otevřeno'}
        </p>
        <p className="mt-1 text-sm text-ink-muted">Stav dveří nebo okna</p>
      </div>
    </section>
  )
}

function ClimateCard({ device, values, range }: { device: Device; values: SensorValues; range: TimeRange }) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const hasTemperature = values.temperature !== undefined
  const hasHumidity = values.humidity !== undefined

  return (
    <section className="rounded-2xl border border-line bg-surface-raised p-5">
      <CardHeader device={device} />
      <div className="mt-8 flex gap-8">
        {hasTemperature && <p className="font-mono text-3xl font-semibold text-warm">{values.temperature?.toFixed(1)}°C</p>}
        {hasHumidity && <p className="font-mono text-3xl font-semibold text-cool">{Math.round(values.humidity ?? 0)}%</p>}
      </div>
      <Button variant="ghost" size="sm" className="mt-6" onClick={() => setHistoryOpen((open) => !open)}>
        {historyOpen ? 'Skrýt historii' : 'Zobrazit historii'}
      </Button>
      {historyOpen && (
        <div className="mt-4 grid gap-4">
          {hasTemperature && <TelemetryFieldChart deviceKey={device.ieeeAddress} field="temperature" range={range} />}
          {hasHumidity && <TelemetryFieldChart deviceKey={device.ieeeAddress} field="humidity" range={range} />}
        </div>
      )}
    </section>
  )
}
