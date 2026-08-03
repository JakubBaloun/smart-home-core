import { usePolling } from '@/hooks/usePolling'
import { LiveDot } from '@/ui/LiveDot'
import { Loading } from '@/ui/Loading'
import { PageHeader } from '@/ui/PageHeader'
import { getDeviceReadings } from '../api/deviceReadings'
import { DeviceGrid } from '../components/DeviceGrid'
import { formatLastSeen } from '../format'

const REFRESH_INTERVAL_MS = 15_000

export function DevicesPage() {
  const { data: readings, error, loading } = usePolling(getDeviceReadings, REFRESH_INTERVAL_MS)

  const devices = readings?.map((r) => r.device)
  const onlineCount = devices?.filter((d) => d.available).length ?? 0
  const mostRecentSeen = devices?.reduce<string | null>((latest, d) => {
    if (!d.lastSeen) return latest
    if (!latest || new Date(d.lastSeen) > new Date(latest)) return d.lastSeen
    return latest
  }, null)

  return (
    <div className="h-full overflow-y-auto px-6 py-5 lg:px-8">
      <PageHeader title="Overview" />
      {loading && !readings && <Loading label="Waking Nexus…" />}
      {error && <p className="text-danger">Failed to load devices: {error.message}</p>}
      {devices && (
        <div className="mb-6 flex items-center justify-between font-mono text-sm text-ink-muted">
          <span className="flex items-center gap-2">
            <LiveDot online={onlineCount > 0} />
            {onlineCount}/{devices.length} devices online
          </span>
          <span className="text-ink-faint">Last seen {formatLastSeen(mostRecentSeen ?? null)}</span>
        </div>
      )}
      {readings && <DeviceGrid readings={readings} />}
    </div>
  )
}
