import { usePolling } from '@/hooks/usePolling'
import { getTelemetryHistory } from '../api/telemetry'
import type { TimeRange } from '../types/telemetry'
import { TelemetryChart } from './TelemetryChart'

const REFRESH_INTERVAL_MS = 15_000

export function TelemetryFieldChart({
  deviceKey,
  field,
  range,
}: {
  deviceKey: string
  field: string
  range: TimeRange
}) {
  const { data } = usePolling(() => getTelemetryHistory(deviceKey, field, range), REFRESH_INTERVAL_MS, [
    deviceKey,
    field,
    range,
  ])

  return (
    <div className="rounded-2xl border border-line bg-surface-raised p-4">
      <h3 className="mb-3 font-mono text-xs tracking-wider text-ink-muted uppercase">{field}</h3>
      <TelemetryChart field={field} points={data?.points ?? []} range={range} />
    </div>
  )
}
