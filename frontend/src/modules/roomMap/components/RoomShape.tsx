import type { RoomReading } from '../api/roomMap'
import type { RoomEdge } from '../config/rooms'

const EDGE_BORDER_CLASSES: Record<RoomEdge, string> = {
  top: 'border-t',
  right: 'border-r',
  bottom: 'border-b',
  left: 'border-l',
}
const ALL_EDGES: RoomEdge[] = ['top', 'right', 'bottom', 'left']

export function RoomShape({ reading }: { reading: RoomReading }) {
  const { room, temperature, humidity } = reading
  const hasData = temperature !== undefined || humidity !== undefined

  return (
    <>
      {room.rects.map(({ top, left, width, height, openEdges = [] }, index) => {
        const borderEdgeClasses = ALL_EDGES.filter((edge) => !openEdges.includes(edge))
          .map((edge) => EDGE_BORDER_CLASSES[edge])
          .join(' ')

        return (
          <div
            key={index}
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
            className={`flex items-center justify-center ${borderEdgeClasses} ${hasData ? 'border-accent' : 'border-line-strong'}`}
          >
            {hasData && index === 0 && (
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
      })}
    </>
  )
}
