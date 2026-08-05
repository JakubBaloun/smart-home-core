import { Link } from 'react-router-dom'
import type { RoomReading } from '@/modules/roomMap/api/roomMap'

export function RoomOverviewCard({
  reading,
  linkable = true,
}: {
  reading: RoomReading
  linkable?: boolean
}) {
  const { room, temperature, humidity, contact } = reading
  const hasData = temperature !== undefined || humidity !== undefined || contact !== undefined

  const content = (
    <>
      <h3 className={`truncate text-sm ${hasData ? 'text-ink-muted' : 'text-ink-faint'}`}>{room.label}</h3>

      {hasData ? (
        <div className="mt-2">
          {temperature !== undefined && (
            <p className="font-mono text-2xl font-semibold tabular-nums text-warm">{temperature.toFixed(1)}°</p>
          )}
          {(humidity !== undefined || contact !== undefined) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs">
              {humidity !== undefined && <span className="tabular-nums text-cool">{Math.round(humidity)}%</span>}
              {contact !== undefined && (
                <span
                  className={`rounded-full border px-2 py-0.5 ${
                    contact ? 'border-ok/40 bg-ok/10 text-ok' : 'border-danger/40 bg-danger/10 text-danger'
                  }`}
                >
                  {contact ? 'zavřeno' : 'otevřeno'}
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-2 font-mono text-xs text-ink-faint">bez senzoru</p>
      )}
    </>
  )

  const className = `block h-full rounded-2xl border p-4 transition ${
    hasData ? 'border-line bg-surface-raised' : 'border-line/60 bg-surface-raised/40'
  } ${linkable ? 'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lg active:scale-[0.98]' : ''}`

  if (!linkable) {
    return <div className={className}>{content}</div>
  }

  return (
    <Link to={`/room/${room.id}`} className={className}>
      {content}
    </Link>
  )
}
