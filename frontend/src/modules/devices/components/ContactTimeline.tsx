import { buildStateSegments, formatDuration } from '../lib/contactSegments'
import type { TelemetryPoint } from '../types/telemetry'

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ContactTimeline({
  points,
  fromMs,
  toMs,
  currentValue,
  field = 'contact',
  isActive = (v: number) => v === 1,
  activeLabel = 'zavřeno',
  inactiveLabel = 'otevřeno',
  activeBadgeClass = 'border-ok/40 bg-ok/10 text-ok',
  inactiveBadgeClass = 'border-danger/40 bg-danger/10 text-danger',
  activeBarClass = 'bg-ok',
  inactiveBarClass = 'bg-danger',
}: {
  points: TelemetryPoint[]
  fromMs: number
  toMs: number
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
  const segments = buildStateSegments(points, fromMs, toMs, { isActive })

  const active =
    currentValue !== undefined
      ? isActive(currentValue)
      : points.length > 0
        ? segments[segments.length - 1].active
        : undefined

  if (active === undefined) {
    return <p className="text-sm text-ink-muted">No data for "{field}" in this range.</p>
  }

  const recentTransitions = segments.length > 1 ? [...segments.slice(1)].reverse().slice(0, 5) : []

  return (
    <div>
      <span
        className={`inline-block rounded-full border px-3 py-1 text-sm ${
          active ? activeBadgeClass : inactiveBadgeClass
        }`}
      >
        {active ? activeLabel : inactiveLabel}
      </span>

      {segments.length > 0 && (
        <div className="mt-4 flex h-7 overflow-hidden rounded-md">
          {segments.map((segment, i) => (
            <div
              key={i}
              className={segment.active ? activeBarClass : inactiveBarClass}
              style={{ width: `${((segment.endMs - segment.startMs) / (toMs - fromMs)) * 100}%` }}
            />
          ))}
        </div>
      )}

      <div className="mt-3 font-mono text-xs text-ink-muted tabular-nums">
        {recentTransitions.length > 0 ? (
          recentTransitions.map((segment, i) => (
            <div key={i}>
              {formatTime(segment.startMs)}–{formatTime(segment.endMs)}{' '}
              {segment.active ? activeLabel : inactiveLabel} ({formatDuration(segment.endMs - segment.startMs)})
            </div>
          ))
        ) : (
          <p>Beze změny v tomto rozsahu</p>
        )}
      </div>
    </div>
  )
}
