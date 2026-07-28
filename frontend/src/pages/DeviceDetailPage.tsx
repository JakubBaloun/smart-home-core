import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getDevice, sendCommand } from '../api/devices'
import { getLatestTelemetry, getTelemetryHistory } from '../api/telemetry'
import { TelemetryChart } from '../components/TelemetryChart'
import { usePolling } from '../hooks/usePolling'
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
    return <p className="p-6 text-red-400">Failed to load device: {deviceError.message}</p>
  }

  if (!device) {
    return <p className="p-6 text-gray-500">Loading...</p>
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <Link to="/" className="text-sm text-gray-500 hover:text-gray-300">
        ← Back to devices
      </Link>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">{device.friendlyName}</h1>
          <p className="text-sm text-gray-500">
            {device.vendor} {device.model} · {device.ieeeAddress}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm ${
            device.available ? 'bg-emerald-900 text-emerald-300' : 'bg-gray-800 text-gray-500'
          }`}
        >
          {device.available ? 'Online' : 'Offline'}
        </span>
      </div>

      {device.type === 'LIGHT' || device.type === 'SWITCH' || device.type === 'PLUG' ? (
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            disabled={sending}
            onClick={() => handleSetState('ON')}
            className="min-h-12 min-w-24 rounded-lg bg-emerald-700 px-6 py-3 font-medium text-white transition hover:bg-emerald-600 disabled:opacity-50"
          >
            Turn On
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={() => handleSetState('OFF')}
            className="min-h-12 min-w-24 rounded-lg bg-gray-800 px-6 py-3 font-medium text-white transition hover:bg-gray-700 disabled:opacity-50"
          >
            Turn Off
          </button>
        </div>
      ) : null}

      {device.type === 'LIGHT' && (
        <div className="mt-6 max-w-md">
          <label htmlFor="brightness" className="mb-2 block text-sm text-gray-400">
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
            className="h-12 w-full accent-purple-500"
          />
        </div>
      )}

      {fields.length > 0 && (
        <div className="mt-8">
          <div className="mb-4 flex gap-2">
            {TIME_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`rounded-lg px-4 py-2 text-sm ${
                  range === r ? 'bg-purple-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
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
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <h3 className="mb-2 text-sm font-medium capitalize text-gray-300">{field}</h3>
      <TelemetryChart field={field} points={data?.points ?? []} />
    </div>
  )
}
