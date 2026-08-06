import { usePolling } from '@/hooks/usePolling'
import { getRangeBounds, getTelemetryHistory } from '../api/telemetry'
import type { TimeRange } from '../types/telemetry'
import { ContactTimeline } from './ContactTimeline'

const REFRESH_INTERVAL_MS = 15_000

export function ContactTimelineCard({
  deviceKey,
  range,
  currentValue,
  field = 'contact',
  isActive,
  activeLabel,
  inactiveLabel,
  activeBadgeClass,
  inactiveBadgeClass,
  activeBarClass,
  inactiveBarClass,
}: {
  deviceKey: string
  range: TimeRange
  currentValue?: number
  field?: string
  isActive?: (value: number) => boolean
  activeLabel?: string
  inactiveLabel?: string
  activeBadgeClass?: string
  inactiveBadgeClass?: string
  activeBarClass?: string
  inactiveBarClass?: string
}) {
  const { data } = usePolling(() => getTelemetryHistory(deviceKey, field, range), REFRESH_INTERVAL_MS, [
    deviceKey,
    field,
    range,
  ])
  const { from, to } = getRangeBounds(range)

  return (
    <div className="rounded-2xl border border-line bg-surface-raised p-4">
      <h3 className="mb-3 font-mono text-xs tracking-wider text-ink-muted uppercase">{field}</h3>
      <ContactTimeline
        points={data?.points ?? []}
        fromMs={from.getTime()}
        toMs={to.getTime()}
        currentValue={currentValue}
        field={field}
        isActive={isActive}
        activeLabel={activeLabel}
        inactiveLabel={inactiveLabel}
        activeBadgeClass={activeBadgeClass}
        inactiveBadgeClass={inactiveBadgeClass}
        activeBarClass={activeBarClass}
        inactiveBarClass={inactiveBarClass}
      />
    </div>
  )
}
