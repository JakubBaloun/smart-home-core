import { usePolling } from '@/hooks/usePolling'
import { getRoomReadings } from '@/modules/roomMap/api/roomMap'
import { Loading } from '@/ui/Loading'
import { PageHeader } from '@/ui/PageHeader'
import { RoomOverviewCard } from '../components/RoomOverviewCard'

const REFRESH_INTERVAL_MS = 15_000

export function RoomOverviewPage() {
  const { data: readings, error, loading } = usePolling(getRoomReadings, REFRESH_INTERVAL_MS)

  return (
    <div className="h-full overflow-y-auto px-6 py-5 lg:px-8">
      <PageHeader title="Home" />
      {loading && !readings && <Loading label="Waking Nexus…" />}
      {error && <p className="text-danger">Failed to load room data: {error.message}</p>}
      {readings && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {readings.map((reading) => (
            <RoomOverviewCard key={reading.room.id} reading={reading} />
          ))}
        </div>
      )}
    </div>
  )
}
