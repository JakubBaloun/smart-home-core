import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { usePolling } from '@/hooks/usePolling'
import { Button } from '@/ui/Button'
import { Loading } from '@/ui/Loading'
import { PageHeader } from '@/ui/PageHeader'
import { labelClasses } from '@/ui/field'
import { getDevice, sendCommand } from '../api/devices'
import { getLatestTelemetry, getTelemetryHistory } from '../api/telemetry'
import { TelemetryChart } from '../components/TelemetryChart'
import type { TimeRange } from '../types/telemetry'

const REFRESH_INTERVAL_MS = 15_000
const TIME_RANGES: TimeRange[] = ['1h', '6h', '24h', '7d']

export function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const deviceId = Number(id)
  const [range, setRange] = useState<TimeRange>('24h')
  const [sending, setSending] = useState(false)

  const { data: device, error: deviceError, refresh: refreshDevice } = usePolling(
    () => getDevice(deviceId),
    REFRESH_INTERVAL_MS,
    [deviceId],
  )

  const { data: latest } = usePolling(
    () => getLatestTelemetry(device?.friendlyName ?? ''),
    REFRESH_INTERVAL_MS,
    [device?.friendlyName],
  )

  const fields = latest ? Object.keys(latest.values) : []

  const handleSetState = async (state: 'ON' | 'OFF') => {
    if (!device) return
    setSending(true)
    try {
      await sendCommand(device.id, { command: 'setState', payload: { state } })
      await refreshDevice()
    } finally {
      setSending(false)
    }
  }

  const handleSetBrightness = async (brightness: number) => {
    if (!device) return
    await sendCommand(device.id, { command: 'setBrightness', payload: { brightness } })
  }

  if (deviceError) {
    return <p className="p-6 text-danger">Failed to load device: {deviceError.message}</p>
  }

  if (!device) {
    return <Loading />
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-5 lg:px-8">
      <PageHeader
        title={device.friendlyName}
        subtitle={
          <span className="font-mono text-xs">
            {device.vendor} {device.model} · {device.ieeeAddress}
          </span>
        }
        back={{ to: '/', label: 'Devices' }}
        actions={
          <span
            className={`rounded-full border px-3 py-1 text-sm ${
              device.available
                ? 'border-ok/40 bg-ok/10 text-ok'
                : 'border-line text-ink-faint'
            }`}
          >
            {device.available ? 'Online' : 'Offline'}
          </span>
        }
      />

      {device.type === 'LIGHT' || device.type === 'SWITCH' || device.type === 'PLUG' ? (
        <div className="mt-2 flex gap-3">
          <Button variant="primary" disabled={sending} onClick={() => handleSetState('ON')} className="min-w-28">
            Turn On
          </Button>
          <Button variant="neutral" disabled={sending} onClick={() => handleSetState('OFF')} className="min-w-28">
            Turn Off
          </Button>
        </div>
      ) : null}

      {device.type === 'LIGHT' && (
        <div className="mt-6 max-w-md">
          <label htmlFor="brightness" className={labelClasses}>
            Brightness
          </label>
          <input
            id="brightness"
            type="range"
            min={0}
            max={254}
            defaultValue={127}
            onMouseUp={(e) => handleSetBrightness(Number(e.currentTarget.value))}
            onTouchEnd={(e) => handleSetBrightness(Number(e.currentTarget.value))}
            className="h-12 w-full accent-accent"
          />
        </div>
      )}

      {fields.length > 0 && (
        <div className="mt-8">
          <div className="mb-4 inline-flex rounded-xl border border-line bg-surface-raised p-1">
            {TIME_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`min-h-10 rounded-lg px-4 font-mono text-sm transition ${
                  range === r ? 'bg-accent text-accent-ink' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {fields.map((field) => (
              <TelemetryFieldChart key={field} deviceName={device.friendlyName} field={field} range={range} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TelemetryFieldChart({
  deviceName,
  field,
  range,
}: {
  deviceName: string
  field: string
  range: TimeRange
}) {
  const { data } = usePolling(() => getTelemetryHistory(deviceName, field, range), REFRESH_INTERVAL_MS, [
    deviceName,
    field,
    range,
  ])

  return (
    <div className="rounded-2xl border border-line bg-surface-raised p-4">
      <h3 className="mb-3 font-mono text-xs tracking-wider text-ink-muted uppercase">{field}</h3>
      <TelemetryChart field={field} points={data?.points ?? []} />
    </div>
  )
}
