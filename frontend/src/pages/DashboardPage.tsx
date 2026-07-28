import { Link } from 'react-router-dom'
import { getDevices } from '../api/devices'
import { DeviceGrid } from '../components/DeviceGrid'
import { usePolling } from '../hooks/usePolling'

const REFRESH_INTERVAL_MS = 15_000

export function DashboardPage() {
  const { data: devices, error, loading } = usePolling(getDevices, REFRESH_INTERVAL_MS)

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-100">Devices</h1>
        <Link to="/recipes" className="text-sm text-purple-400 hover:text-purple-300">
          Recipes · Cook Mode →
        </Link>
      </div>
      {loading && !devices && <p className="text-gray-500">Loading devices...</p>}
      {error && <p className="text-red-400">Failed to load devices: {error.message}</p>}
      {devices && <DeviceGrid devices={devices} />}
    </div>
  )
}
