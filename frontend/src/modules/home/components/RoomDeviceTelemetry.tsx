import { usePolling } from '@/hooks/usePolling'
import { getLatestTelemetry } from '@/modules/devices/api/telemetry'
import { ContactTimelineCard } from '@/modules/devices/components/ContactTimelineCard'
import { TelemetryFieldChart } from '@/modules/devices/components/TelemetryFieldChart'
import { sortFieldsForDisplay } from '@/modules/devices/lib/fieldOrder'
import type { Device } from '@/modules/devices/types/device'
import type { TimeRange } from '@/modules/devices/types/telemetry'

const REFRESH_INTERVAL_MS = 15_000

export function RoomDeviceTelemetry({ device, range }: { device: Device; range: TimeRange }) {
  const { data: latest } = usePolling(
    () => getLatestTelemetry(device.ieeeAddress),
    REFRESH_INTERVAL_MS,
    [device.ieeeAddress],
  )

  const allFields = latest ? Object.keys(latest.values) : []
  const hasContact = allFields.includes('contact')
  const chartFields = sortFieldsForDisplay(allFields.filter((f) => f !== 'contact'))

  if (!hasContact && chartFields.length === 0) return null

  return (
    <div>
      <h3 className="mb-3 text-sm text-ink-muted">{device.friendlyName}</h3>

      {hasContact && (
        <div className="mb-4">
          <ContactTimelineCard deviceKey={device.ieeeAddress} range={range} currentValue={latest?.values.contact} />
        </div>
      )}

      {chartFields.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {chartFields.map((field) => (
            <TelemetryFieldChart key={field} deviceKey={device.ieeeAddress} field={field} range={range} />
          ))}
        </div>
      )}
    </div>
  )
}
