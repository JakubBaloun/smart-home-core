import { usePolling } from '@/hooks/usePolling'
import { Loading } from '@/ui/Loading'
import { PageHeader } from '@/ui/PageHeader'
import { getTemperatureReadings } from '../api/temperature'
import { TemperatureCard } from '../components/TemperatureCard'

const REFRESH_INTERVAL_MS = 15_000

export function TemperaturePage() {
  const { data: readings, error, loading } = usePolling(getTemperatureReadings, REFRESH_INTERVAL_MS)

  return (
    <div className="h-full overflow-y-auto px-6 py-5 lg:px-8">
      <PageHeader title="Temperature" />
      {loading && !readings && <Loading label="Reading sensors…" />}
      {error && <p className="text-danger">Failed to load temperature data: {error.message}</p>}
      {readings && readings.length === 0 && (
        <p className="text-ink-muted">No temperature sensors found.</p>
      )}
      {readings && readings.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {readings.map(({ device, latest }, index) => (
            <TemperatureCard key={device.id} device={device} latest={latest} delayMs={index * 40} />
          ))}
        </div>
      )}
    </div>
  )
}
