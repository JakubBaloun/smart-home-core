import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { usePolling } from '@/hooks/usePolling'
import { sendCommand } from '@/modules/devices/api/devices'
import { getLatestTelemetry } from '@/modules/devices/api/telemetry'
import { LightControls } from '@/modules/devices/components/LightControls'
import { TelemetryFieldChart } from '@/modules/devices/components/TelemetryFieldChart'
import type { Device } from '@/modules/devices/types/device'
import type { TimeRange } from '@/modules/devices/types/telemetry'
import { Button } from '@/ui/Button'
import { LiveDot } from '@/ui/LiveDot'
import { IconBulb, IconCube, IconDroplet, IconPlug, IconSensor, IconSwitch, IconThermometer } from '@/ui/icons'

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
  const [optimisticStates, setOptimisticStates] = useState<Record<number, 'ON' | 'OFF'>>({})
  const [reportedStates, setReportedStates] = useState<Record<string, 'ON' | 'OFF'>>({})
  const deviceKeys = devices.map((device) => device.ieeeAddress).join(',')
  const { data: summaries } = usePolling(
    () => getRoomDeviceSummaries(devices),
    REFRESH_INTERVAL_MS,
    [deviceKeys],
  )

  useEffect(() => {
    if (typeof EventSource === 'undefined') return

    const source = new EventSource('/api/devices/events')
    const onState = (message: Event) => {
      const { ieeeAddress, state } = JSON.parse((message as MessageEvent<string>).data) as {
        ieeeAddress: string
        state: 'ON' | 'OFF'
      }
      if (state !== 'ON' && state !== 'OFF') return

      setReportedStates((states) => ({ ...states, [ieeeAddress]: state }))
      const device = devices.find((candidate) => candidate.ieeeAddress === ieeeAddress)
      if (!device) return
      setOptimisticStates((states) => {
        if (states[device.id] !== state) return states
        const { [device.id]: _confirmed, ...remaining } = states
        return remaining
      })
    }

    source.addEventListener('state', onState)
    return () => {
      source.removeEventListener('state', onState)
      source.close()
    }
  }, [deviceKeys, devices])

  const handleToggle = async (device: Device, currentState: 'ON' | 'OFF' | null) => {
    const nextState = currentState === 'ON' ? 'OFF' : 'ON'
    setOptimisticStates((states) => ({ ...states, [device.id]: nextState }))
    setTogglingId(device.id)
    try {
      await sendCommand(device.id, {
        command: 'setState',
        payload: { state: nextState },
      })
    } catch {
      setOptimisticStates(({ [device.id]: _discarded, ...states }) => states)
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
    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visibleSummaries.map(({ device, values }) => {
        if (CONTROLLABLE_TYPES.has(device.type)) {
          const state = optimisticStates[device.id] ?? reportedStates[device.ieeeAddress] ?? device.state
          return (
            <ControlCard
              key={device.id}
              device={device}
              toggling={togglingId === device.id}
              state={state}
              onToggle={() => handleToggle(device, state)}
            />
          )
        }

        if (values?.contact !== undefined) return <ContactCard key={device.id} device={device} contact={values.contact} />

        const cards = []
        if (values?.temperature !== undefined) {
          cards.push(
            <TemperatureCard
              key={`${device.id}-temperature`}
              device={device}
              temperature={values.temperature}
              range={range}
            />,
          )
        }
        if (values?.humidity !== undefined) {
          cards.push(
            <HumidityCard key={`${device.id}-humidity`} device={device} humidity={values.humidity} range={range} />,
          )
        }
        return cards
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

function ControlCard({
  device,
  state,
  toggling,
  onToggle,
}: {
  device: Device
  state: 'ON' | 'OFF' | null
  toggling: boolean
  onToggle: () => void
}) {
  const isOn = state === 'ON'
  const isLight = device.type === 'LIGHT'
  return (
    <section className={`flex ${isLight ? 'min-h-64' : 'min-h-48'} flex-col justify-between rounded-2xl border border-line bg-surface-raised p-5`}>
      <CardHeader device={device} />
      <div className="mt-8">
        <p className={`font-mono text-3xl font-semibold ${isOn ? 'text-warm' : 'text-ink-muted'}`}>
          {isOn ? 'Zapnuto' : 'Vypnuto'}
        </p>
        <p className="mt-1 text-sm text-ink-muted">{state === null ? 'Stav se načte po další zprávě zařízení.' : 'Aktuální stav zařízení'}</p>
      </div>
      <Button variant={isOn ? 'neutral' : 'primary'} className="mt-6 w-full" disabled={toggling} onClick={onToggle}>
        {isOn ? 'Vypnout' : 'Zapnout'}
      </Button>
      {/* Pass the optimistic/reported `state`, not device.state directly, so the sliders
          enable/disable in step with the Zapnout/Vypnout button instead of lagging behind
          the next poll. */}
      {isLight && <LightControls device={{ ...device, state }} />}
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

function TemperatureCard({ device, temperature, range }: { device: Device; temperature: number; range: TimeRange }) {
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <section className="rounded-2xl border border-line bg-surface-raised p-5">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/device/${device.id}`} className="flex min-w-0 items-center gap-3 hover:text-accent">
          <IconThermometer className="size-5 shrink-0 text-ink-muted" />
          <h3 className="truncate text-base font-medium text-ink">{device.friendlyName}</h3>
        </Link>
        <span title={device.available ? 'Online' : 'Offline'}>
          <LiveDot online={device.available} />
        </span>
      </div>
      <p className="mt-8 font-mono text-3xl font-semibold text-warm">{temperature.toFixed(1)}°C</p>
      <Button variant="ghost" size="sm" className="mt-6" onClick={() => setHistoryOpen((open) => !open)}>
        {historyOpen ? 'Skrýt historii' : 'Zobrazit historii'}
      </Button>
      {historyOpen && (
        <div className="mt-4 rounded-xl border border-line bg-surface-sunken/40 p-3">
          <TelemetryFieldChart deviceKey={device.ieeeAddress} field="temperature" range={range} />
        </div>
      )}
    </section>
  )
}

function HumidityCard({ device, humidity, range }: { device: Device; humidity: number; range: TimeRange }) {
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <section className="rounded-2xl border border-line bg-surface-raised p-5">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/device/${device.id}`} className="flex min-w-0 items-center gap-3 hover:text-accent">
          <IconDroplet className="size-5 shrink-0 text-ink-muted" />
          <h3 className="truncate text-base font-medium text-ink">{device.friendlyName}</h3>
        </Link>
        <span title={device.available ? 'Online' : 'Offline'}>
          <LiveDot online={device.available} />
        </span>
      </div>
      <p className="mt-8 font-mono text-3xl font-semibold text-cool">{Math.round(humidity)}%</p>
      <Button variant="ghost" size="sm" className="mt-6" onClick={() => setHistoryOpen((open) => !open)}>
        {historyOpen ? 'Skrýt historii' : 'Zobrazit historii'}
      </Button>
      {historyOpen && (
        <div className="mt-4 rounded-xl border border-line bg-surface-sunken/40 p-3">
          <TelemetryFieldChart deviceKey={device.ieeeAddress} field="humidity" range={range} />
        </div>
      )}
    </section>
  )
}
