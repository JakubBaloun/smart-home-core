import type { TimeRange } from '../types/telemetry'
import { ContactTimelineCard } from './ContactTimelineCard'

/**
 * Light on/off timeline. Uses the accent/surface-sunken color pair rather
 * than the door's danger/ok semantics — a light being on is not a safety
 * state, just a mode.
 */
export function StateTimelineCard({
  deviceKey,
  range,
  currentValue,
}: {
  deviceKey: string
  range: TimeRange
  currentValue?: number
}) {
  return (
    <ContactTimelineCard
      deviceKey={deviceKey}
      range={range}
      currentValue={currentValue}
      field="state"
      isActive={(v) => v === 1}
      activeLabel="zapnuto"
      inactiveLabel="vypnuto"
      activeBadgeClass="border-accent/40 bg-accent/10 text-accent"
      inactiveBadgeClass="border-line bg-surface-sunken text-ink-muted"
      activeBarClass="bg-accent"
      inactiveBarClass="bg-surface-sunken"
    />
  )
}
