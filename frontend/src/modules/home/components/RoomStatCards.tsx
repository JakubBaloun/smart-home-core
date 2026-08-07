import type { ComponentType } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Line, LineChart, ResponsiveContainer } from 'recharts'
import { usePolling } from '@/hooks/usePolling'
import { sendCommand } from '@/modules/devices/api/devices'
import { getLatestTelemetry, getTelemetryHistory } from '@/modules/devices/api/telemetry'
import { buildStateSegments } from '@/modules/devices/lib/contactSegments'
import { computeDelta, formatSignedDelta, rangeLabel, trendWord } from '@/modules/devices/lib/trend'
import type { Device } from '@/modules/devices/types/device'
import type { TelemetryPoint, TimeRange } from '@/modules/devices/types/telemetry'
import { IconBulb, IconDroplet, IconPlug, IconSensor, IconSwitch, IconThermometer } from '@/ui/icons'

const REFRESH_INTERVAL_MS = 15_000

const HUMIDITY_TREND_THRESHOLD = 2

interface StatCardShellProps {
  device: Device
  icon: ComponentType<{ className?: string }>
  primary: string
  secondary?: string
  headerAction?: React.ReactNode
  children?: React.ReactNode
}

function StatCardShell({ device, icon: Icon, primary, secondary, headerAction, children }: StatCardShellProps) {
  return (
    <section className="flex min-w-[220px] flex-1 flex-col rounded-2xl border border-line bg-surface-raised p-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          to={`/device/${device.id}`}
          className="-m-2 flex min-h-11 min-w-0 flex-1 items-center gap-2 p-2 text-ink-muted hover:text-accent"
        >
          <Icon className="size-4 shrink-0" />
          <h3 className="truncate text-sm">{device.friendlyName}</h3>
        </Link>
        {headerAction}
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold text-ink">{primary}</p>
      {secondary && <p className="mt-1 text-xs text-ink-muted">{secondary}</p>}
      {children}
    </section>
  )
}

function LightToggle({ checked, onToggle, disabled }: { checked: boolean; onToggle: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={checked ? 'Vypnout' : 'Zapnout'}
      disabled={disabled}
      onClick={onToggle}
      className="-m-2 flex min-h-11 min-w-11 shrink-0 items-center justify-center p-2 disabled:opacity-50 active:scale-95 transition-transform"
    >
      <span
        className={`relative inline-flex h-7 w-12 items-center rounded-full border transition-colors duration-200 ease-out ${
          checked
            ? 'border-accent bg-accent shadow-[0_0_10px_-2px_var(--accent)]'
            : 'border-line bg-surface'
        }`}
      >
        <span
          className={`inline-block size-5 transform rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform duration-200 ease-out ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </span>
    </button>
  )
}

function Sparkline({ points, color }: { points: TelemetryPoint[]; color: string }) {
  if (points.length < 2) return null
  const data = points.map((p) => ({ time: p.time, value: p.value }))
  return (
    <div className="mt-3 h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function TemperatureStatCard({ device, temperature, range }: { device: Device; temperature: number; range: TimeRange }) {
  const { data } = usePolling(
    () => getTelemetryHistory(device.ieeeAddress, 'temperature', range),
    REFRESH_INTERVAL_MS,
    [device.ieeeAddress, range],
  )
  const delta = computeDelta(data?.points ?? [])
  const secondary = delta !== null ? `${formatSignedDelta(delta, '°')} ${rangeLabel(range)}` : undefined

  return (
    <StatCardShell device={device} icon={IconThermometer} primary={`${temperature.toFixed(1)}°C`} secondary={secondary}>
      <Sparkline points={data?.points ?? []} color="currentColor" />
    </StatCardShell>
  )
}

function HumidityStatCard({ device, humidity, range }: { device: Device; humidity: number; range: TimeRange }) {
  const { data } = usePolling(
    () => getTelemetryHistory(device.ieeeAddress, 'humidity', range),
    REFRESH_INTERVAL_MS,
    [device.ieeeAddress, range],
  )
  const delta = computeDelta(data?.points ?? [])
  const trend = trendWord(delta, HUMIDITY_TREND_THRESHOLD)

  return (
    <StatCardShell device={device} icon={IconDroplet} primary={`${Math.round(humidity)} %`} secondary={trend}>
      <Sparkline points={data?.points ?? []} color="currentColor" />
    </StatCardShell>
  )
}

function ContactStatCard({ device, contact, range }: { device: Device; contact: number; range: TimeRange }) {
  const { data } = usePolling(
    () => getTelemetryHistory(device.ieeeAddress, 'contact', range),
    REFRESH_INTERVAL_MS,
    [device.ieeeAddress, range],
  )
  const isClosed = contact === 1
  const points = data?.points ?? []
  const fromMs = points.length > 0 ? new Date(points[0].time).getTime() : Date.now()
  const toMs = Date.now()
  const segments = buildStateSegments(points, fromMs, toMs, { isActive: (v) => v === 1 })
  const lastOpenTransition = [...segments].reverse().find((s) => !s.active)
  const secondary = lastOpenTransition
    ? `naposledy otevřeno ${new Date(lastOpenTransition.startMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : undefined

  return (
    <StatCardShell
      device={device}
      icon={IconSensor}
      primary={isClosed ? 'Zavřeno' : 'Otevřeno'}
      secondary={secondary}
    >
      <span
        className={`mt-2 inline-block h-1.5 w-full rounded-full ${isClosed ? 'bg-ok' : 'bg-danger'}`}
        aria-hidden
      />
    </StatCardShell>
  )
}

function LightStatCard({ device, onRefresh }: { device: Device; onRefresh: () => void | Promise<void> }) {
  const [sending, setSending] = useState(false)
  const [optimisticOn, setOptimisticOn] = useState<boolean | null>(null)
  const isOn = optimisticOn ?? device.state === 'ON'
  const brightnessPct = device.brightness !== null ? Math.round((device.brightness / 254) * 100) : null
  const secondary = isOn && brightnessPct !== null ? `${brightnessPct} %` : undefined
  const icon = device.type === 'LIGHT' ? IconBulb : device.type === 'PLUG' ? IconPlug : IconSwitch

  useEffect(() => {
    // onRefresh (and the background poll) can return a snapshot from before
    // the just-sent command has propagated through Z2M/DB. Only clear the
    // optimistic value once device.state actually confirms it — an
    // unconfirmed or contradicting update must not clobber a pending intent.
    setOptimisticOn((prev) => {
      if (prev === null) return null
      const confirmed = prev ? 'ON' : 'OFF'
      return device.state === confirmed ? null : prev
    })
  }, [device.state])

  const handleToggle = async () => {
    const nextOn = !isOn
    setOptimisticOn(nextOn)
    setSending(true)
    try {
      await sendCommand(device.id, { command: 'setState', payload: { state: nextOn ? 'ON' : 'OFF' } })
      await onRefresh()
    } finally {
      setSending(false)
    }
  }

  return (
    <StatCardShell
      device={device}
      icon={icon}
      primary={isOn ? 'Zapnuto' : 'Vypnuto'}
      secondary={secondary}
      headerAction={<LightToggle checked={isOn} onToggle={handleToggle} disabled={sending} />}
    >
      <span className={`mt-2 inline-block h-1.5 w-full rounded-full ${isOn ? 'bg-accent' : 'bg-line'}`} aria-hidden />
    </StatCardShell>
  )
}

function SensorCards({ device, range }: { device: Device; range: TimeRange }) {
  const { data: latest } = usePolling(
    () => getLatestTelemetry(device.ieeeAddress),
    REFRESH_INTERVAL_MS,
    [device.ieeeAddress],
  )
  if (!latest) return null

  const cards = []
  if (typeof latest.values.temperature === 'number') {
    cards.push(<TemperatureStatCard key={`${device.id}-t`} device={device} temperature={latest.values.temperature} range={range} />)
  }
  if (typeof latest.values.humidity === 'number') {
    cards.push(<HumidityStatCard key={`${device.id}-h`} device={device} humidity={latest.values.humidity} range={range} />)
  }
  if (typeof latest.values.contact === 'number') {
    cards.push(<ContactStatCard key={`${device.id}-c`} device={device} contact={latest.values.contact} range={range} />)
  }
  return <>{cards}</>
}

export function RoomStatCards({
  devices,
  range,
  onRefresh,
}: {
  devices: Device[]
  range: TimeRange
  onRefresh: () => void | Promise<void>
}) {
  return (
    <div className="flex flex-wrap gap-4">
      {devices.map((device) => {
        if (device.type === 'LIGHT' || device.type === 'SWITCH' || device.type === 'PLUG') {
          return <LightStatCard key={device.id} device={device} onRefresh={onRefresh} />
        }
        if (device.type === 'SENSOR') {
          return <SensorCards key={device.id} device={device} range={range} />
        }
        return null
      })}
    </div>
  )
}
