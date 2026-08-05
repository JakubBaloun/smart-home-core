import { useState } from 'react'
import { usePolling } from '@/hooks/usePolling'
import { getTelemetryHistory } from '@/modules/devices/api/telemetry'
import { TelemetryChart } from '@/modules/devices/components/TelemetryChart'
import { formatLastSeen } from '@/modules/devices/format'
import type { Device } from '@/modules/devices/types/device'
import type { LatestTelemetryResponse, TimeRange } from '@/modules/devices/types/telemetry'
import { IconThermometer } from '@/ui/icons'
import { LiveDot } from '@/ui/LiveDot'

const REFRESH_INTERVAL_MS = 15_000
const TIME_RANGES: TimeRange[] = ['1h', '6h', '24h', '7d']

export function TemperatureCard({
  device,
  latest,
  delayMs = 0,
}: {
  device: Device
  latest: LatestTelemetryResponse
  delayMs?: number
}) {
  const [range, setRange] = useState<TimeRange>('24h')

  const { data: history } = usePolling(
    () => getTelemetryHistory(device.ieeeAddress, 'temperature', range),
    REFRESH_INTERVAL_MS,
    [device.ieeeAddress, range],
  )

  const value = latest.values.temperature

  return (
    <div
      style={{ animationDelay: `${delayMs}ms` }}
      className="animate-fade-slide-in rounded-2xl border border-line bg-surface-raised p-5 transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lg"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 text-ink-muted">
          <IconThermometer className="size-5" />
          <h3 className="truncate text-sm tracking-wide uppercase">{device.friendlyName}</h3>
        </div>
        <span title={device.available ? 'Online' : 'Offline'}>
          <LiveDot online={device.available} />
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
      <p className="mt-1 font-mono text-xs text-ink-faint">
        Updated {formatLastSeen(latest.lastUpdated, 'No data yet')}
      </p>

      <div className="mt-5">
        <div className="mb-3 inline-flex rounded-xl border border-line bg-surface-sunken p-1">
          {TIME_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`min-h-11 rounded-lg px-3 font-mono text-xs transition ${
                range === r ? 'bg-accent text-accent-ink' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <TelemetryChart field="temperature" points={history?.points ?? []} heightPx={192} />
      </div>
    </div>
  )
}
