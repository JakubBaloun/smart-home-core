import { usePolling } from '@/hooks/usePolling'
import { Loading } from '@/ui/Loading'
import { PageHeader } from '@/ui/PageHeader'
import { getRoomReadings } from '../api/roomMap'
import { RoomTile } from '../components/RoomTile'

const REFRESH_INTERVAL_MS = 15_000

const GRID_TEMPLATE_AREAS = `
  "living  living  kitchen"
  "living  living  kitchen"
  "hallway hallway kids"
  "bedroom bathroom kids"
`

export function RoomMapPage() {
  const { data: readings, error, loading } = usePolling(getRoomReadings, REFRESH_INTERVAL_MS)

  return (
    <div className="h-full overflow-y-auto px-6 py-5 lg:px-8">
      <PageHeader title="Room Map" />
      {loading && !readings && <Loading label="Reading rooms…" />}
      {error && <p className="text-danger">Failed to load room data: {error.message}</p>}
      {readings && (
        <div
          className="grid grid-cols-3 gap-4"
          style={{ gridTemplateAreas: GRID_TEMPLATE_AREAS }}
        >
          {readings.map((reading) => (
            <RoomTile key={reading.room.id} reading={reading} />
          ))}
        </div>
      )}
    </div>
  )
}
