import { usePolling } from '@/hooks/usePolling'
import { Loading } from '@/ui/Loading'
import { PageHeader } from '@/ui/PageHeader'
import { getDevices } from '../api/devices'
import { DeviceGrid } from '../components/DeviceGrid'

const REFRESH_INTERVAL_MS = 15_000

export function DashboardPage() {
  const { data: devices, error, loading } = usePolling(getDevices, REFRESH_INTERVAL_MS)

  return (
    <div className="h-full overflow-y-auto px-6 py-5 lg:px-8">
      <PageHeader title="Devices" />
      {loading && !devices && <Loading label="Waking Nexus…" />}
      {error && <p className="text-danger">Failed to load devices: {error.message}</p>}
      {devices && <DeviceGrid devices={devices} />}
    </div>
  )
}
