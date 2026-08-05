import { usePolling } from '@/hooks/usePolling'
import { getRangeBounds, getTelemetryHistory } from '../api/telemetry'
import type { TimeRange } from '../types/telemetry'
import { ContactTimeline } from './ContactTimeline'

const REFRESH_INTERVAL_MS = 15_000

export function ContactTimelineCard({
  deviceKey,
  range,
  currentValue,
}: {
  deviceKey: string
  range: TimeRange
  currentValue?: number
}) {
  const { data } = usePolling(() => getTelemetryHistory(deviceKey, 'contact', range), REFRESH_INTERVAL_MS, [
    deviceKey,
    range,
  ])
  const { from, to } = getRangeBounds(range)

  return (
    <div className="rounded-2xl border border-line bg-surface-raised p-4">
      <h3 className="mb-3 font-mono text-xs tracking-wider text-ink-muted uppercase">contact</h3>
      <ContactTimeline
        points={data?.points ?? []}
        fromMs={from.getTime()}
        toMs={to.getTime()}
        currentValue={currentValue}
      />
    </div>
  )
}
