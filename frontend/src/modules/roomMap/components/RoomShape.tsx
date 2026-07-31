import type { RoomReading } from '../api/roomMap'

export function RoomShape({ reading }: { reading: RoomReading }) {
  const { room, temperature, humidity } = reading
  const { top, left, width, height } = room.rect
  const hasData = temperature !== undefined || humidity !== undefined

  return (
    <div
      data-testid="room-shape"
      data-has-data={hasData}
      title={room.label}
      aria-label={room.label}
      style={{
        position: 'absolute',
        top: `${top}%`,
        left: `${left}%`,
        width: `${width}%`,
        height: `${height}%`,
      }}
      className={`flex items-center justify-center border ${hasData ? 'border-accent' : 'border-line-strong'}`}
    >
      {hasData && (
        <div className="flex items-baseline gap-2 font-mono">
          {temperature !== undefined && (
            <span className="text-lg font-semibold text-accent tabular-nums">{temperature.toFixed(1)}°C</span>
          )}
          {humidity !== undefined && (
            <span className="text-sm text-accent tabular-nums">{Math.round(humidity)}%</span>
          )}
        </div>
      )}
    </div>
  )
}
