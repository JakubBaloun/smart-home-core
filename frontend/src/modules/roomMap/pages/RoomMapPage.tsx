import { usePolling } from '@/hooks/usePolling'
import { Loading } from '@/ui/Loading'
import { PageHeader } from '@/ui/PageHeader'
import { getRoomReadings } from '../api/roomMap'
import { RoomShape } from '../components/RoomShape'

const REFRESH_INTERVAL_MS = 15_000

export function RoomMapPage() {
  const { data: readings, error, loading } = usePolling(getRoomReadings, REFRESH_INTERVAL_MS)

  return (
    <div className="h-full overflow-y-auto px-6 py-5 lg:px-8">
      <PageHeader title="Room Map" />
      {loading && !readings && <Loading label="Reading rooms…" />}
      {error && <p className="text-danger">Failed to load room data: {error.message}</p>}
      {readings && (
        <div className="relative aspect-square w-full bg-surface-sunken sm:aspect-[9/4]">
          {readings.map((reading) => (
            <RoomShape key={reading.room.id} reading={reading} />
          ))}
        </div>
      )}
    </div>
  )
}
