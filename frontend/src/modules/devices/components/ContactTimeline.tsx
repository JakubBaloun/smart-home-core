import { buildContactSegments, formatDuration } from '../lib/contactSegments'
import type { TelemetryPoint } from '../types/telemetry'

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ContactTimeline({
  points,
  fromMs,
  toMs,
  currentValue,
}: {
  points: TelemetryPoint[]
  fromMs: number
  toMs: number
  currentValue?: number
}) {
  const segments = buildContactSegments(points, fromMs, toMs)

  const closed =
    currentValue !== undefined
      ? currentValue === 1
      : points.length > 0
        ? segments[segments.length - 1].closed
        : undefined

  if (closed === undefined) {
    return <p className="text-sm text-ink-muted">No data for "contact" in this range.</p>
  }

  const recentTransitions = segments.length > 1 ? [...segments.slice(1)].reverse().slice(0, 5) : []

  return (
    <div>
      <span
        className={`inline-block rounded-full border px-3 py-1 text-sm ${
          closed ? 'border-ok/40 bg-ok/10 text-ok' : 'border-danger/40 bg-danger/10 text-danger'
        }`}
      >
        {closed ? 'zavřeno' : 'otevřeno'}
      </span>

      {segments.length > 0 && (
        <div className="mt-4 flex h-7 overflow-hidden rounded-md">
          {segments.map((segment, i) => (
            <div
              key={i}
              className={segment.closed ? 'bg-ok' : 'bg-danger'}
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
              {segment.closed ? 'zavřeno' : 'otevřeno'} ({formatDuration(segment.endMs - segment.startMs)})
            </div>
          ))
        ) : (
          <p>Beze změny v tomto rozsahu</p>
        )}
      </div>
    </div>
  )
}
