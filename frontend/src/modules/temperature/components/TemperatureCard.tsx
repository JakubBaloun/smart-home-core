import { useState } from 'react'
import { usePolling } from '@/hooks/usePolling'
import { getTelemetryHistory } from '@/modules/devices/api/telemetry'
import type { Device } from '@/modules/devices/types/device'
import type { LatestTelemetryResponse, TimeRange } from '@/modules/devices/types/telemetry'
import { IconThermometer } from '@/ui/icons'
import { Ring } from '@/ui/Ring'
import { TemperatureChart } from './TemperatureChart'

const REFRESH_INTERVAL_MS = 15_000
const TIME_RANGES: TimeRange[] = ['1h', '6h', '24h', '7d']

function formatUpdated(iso: string | null): string {
  if (!iso) return 'No data yet'
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function TemperatureCard({ device, latest }: { device: Device; latest: LatestTelemetryResponse }) {
  const [range, setRange] = useState<TimeRange>('24h')

  const { data: history } = usePolling(
    () => getTelemetryHistory(device.ieeeAddress, 'temperature', range),
    REFRESH_INTERVAL_MS,
    [device.ieeeAddress, range],
  )

  const value = latest.values.temperature

  return (
    <div className="rounded-2xl border border-line bg-surface-raised p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 text-ink-muted">
          <IconThermometer className="size-5" />
          <h3 className="truncate text-sm tracking-wide uppercase">{device.friendlyName}</h3>
        </div>
        <span title={device.available ? 'Online' : 'Offline'}>
          <Ring size={14} strokeWidth={7} className={device.available ? 'text-ok' : 'text-ink-faint'} />
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span
          className={`font-display text-5xl font-semibold tabular-nums ${
            device.available ? 'text-ink' : 'text-ink-muted'
          }`}
        >
          {value.toFixed(1)}
        </span>
        <span className="text-2xl text-ink-muted">°C</span>
      </div>
      <p className="mt-1 font-mono text-xs text-ink-faint">Updated {formatUpdated(latest.lastUpdated)}</p>

      <div className="mt-5">
        <div className="mb-3 inline-flex rounded-xl border border-line bg-surface-sunken p-1">
          {TIME_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`min-h-8 rounded-lg px-3 font-mono text-xs transition ${
                range === r ? 'bg-accent text-accent-ink' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <TemperatureChart points={history?.points ?? []} />
      </div>
    </div>
  )
}
