import type { RoomReading } from '../api/roomMap'

export function RoomTile({ reading }: { reading: RoomReading }) {
  const { room, temperature, humidity } = reading
  const hasData = temperature !== undefined || humidity !== undefined

  return (
    <div
      data-testid="room-tile"
      data-has-data={hasData}
      style={{ gridArea: room.area }}
      className={`flex flex-col justify-between rounded-2xl border border-line p-4 ${
        hasData ? 'bg-surface-raised' : 'bg-surface-sunken'
      }`}
    >
      <h3 className={`text-sm tracking-wide uppercase ${hasData ? 'text-ink-muted' : 'text-ink-faint'}`}>
        {room.label}
      </h3>
      {hasData ? (
        <div className="mt-3 flex items-baseline gap-3 font-mono">
          {temperature !== undefined && (
            <span className="text-2xl font-semibold text-ink tabular-nums">{temperature.toFixed(1)}°C</span>
          )}
          {humidity !== undefined && (
            <span className="text-lg text-ink-muted tabular-nums">{Math.round(humidity)}%</span>
          )}
        </div>
      ) : (
        <p className="mt-3 font-mono text-sm text-ink-faint">–</p>
      )}
    </div>
  )
}
