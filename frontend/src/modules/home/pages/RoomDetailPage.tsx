import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { getDeviceReadings } from '@/modules/devices/api/deviceReadings'
import { DeviceGrid } from '@/modules/devices/components/DeviceGrid'
import type { TimeRange } from '@/modules/devices/types/telemetry'
import { rooms } from '@/modules/roomMap/config/rooms'
import { usePolling } from '@/hooks/usePolling'
import { Loading } from '@/ui/Loading'
import { PageHeader } from '@/ui/PageHeader'
import { RoomHistorySections } from '../components/RoomHistorySections'
import { RoomStatCards } from '../components/RoomStatCards'

const REFRESH_INTERVAL_MS = 15_000
const TIME_RANGES: TimeRange[] = ['1h', '6h', '24h', '7d', '30d']

export function RoomDetailPage() {
  const { id } = useParams<{ id: string }>()
  const room = rooms.find((r) => r.id === id)
  const [range, setRange] = useState<TimeRange>('24h')
  const { data: readings, error, loading, refresh } = usePolling(getDeviceReadings, REFRESH_INTERVAL_MS)

  if (!room) {
    return (
      <div className="h-full overflow-y-auto px-6 py-5 lg:px-8">
        <PageHeader title="Pokoj nenalezen" back={{ to: '/', label: 'Home' }} />
      </div>
    )
  }

  if (room.deviceIeeeAddresses.length === 0) {
    return (
      <div className="h-full overflow-y-auto px-6 py-5 lg:px-8">
        <PageHeader title={room.label} back={{ to: '/', label: 'Home' }} />
        <p className="text-ink-muted">V tomto pokoji nejsou zaregistrovaná žádná zařízení.</p>
      </div>
    )
  }

  const roomReadings = readings?.filter((r) => room.deviceIeeeAddresses.includes(r.device.ieeeAddress)) ?? []
  const roomDevices = roomReadings.map((reading) => reading.device)

  return (
    <div className="h-full overflow-y-auto px-6 py-5 lg:px-8">
      <PageHeader title={room.label} back={{ to: '/', label: 'Home' }} />

      {loading && !readings && <Loading label="Načítám pokoj…" />}
      {error && <p className="text-danger">Failed to load room data: {error.message}</p>}

      {readings && (
        <>
          <div className="mt-8">
            <div className="mb-4 inline-flex rounded-full border border-line bg-surface-raised p-1">
              {TIME_RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={`min-h-11 rounded-full px-4 font-mono text-sm transition ${
                    range === r ? 'bg-accent text-accent-ink' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <RoomStatCards devices={roomDevices} range={range} onRefresh={refresh} />
            <RoomHistorySections devices={roomDevices} range={range} />
          </div>

          <div className="mt-8">
            <DeviceGrid readings={roomReadings} variant="list" defaultCollapsed />
          </div>
        </>
      )}
    </div>
  )
}
