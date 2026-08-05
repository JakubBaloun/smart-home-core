import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePolling } from '@/hooks/usePolling'
import { Button } from '@/ui/Button'
import { Loading } from '@/ui/Loading'
import { PageHeader } from '@/ui/PageHeader'
import { fieldClasses, labelClasses } from '@/ui/field'
import { deleteDevice, getDevice, sendCommand, updateDevice } from '../api/devices'
import { getLatestTelemetry } from '../api/telemetry'
import { ContactTimelineCard } from '../components/ContactTimelineCard'
import { TelemetryFieldChart } from '../components/TelemetryFieldChart'
import { sortFieldsForDisplay } from '../lib/fieldOrder'
import type { DeviceType, UpdateDeviceRequest } from '../types/device'
import type { TimeRange } from '../types/telemetry'

const REFRESH_INTERVAL_MS = 15_000
const TIME_RANGES: TimeRange[] = ['1h', '6h', '24h', '7d']
const DEVICE_TYPES: DeviceType[] = ['LIGHT', 'SENSOR', 'SWITCH', 'PLUG', 'OTHER']

export function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const deviceId = Number(id)
  const navigate = useNavigate()
  const [range, setRange] = useState<TimeRange>('24h')
  const [sending, setSending] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [form, setForm] = useState<UpdateDeviceRequest | null>(null)

  const { data: device, error: deviceError, refresh: refreshDevice } = usePolling(
    () => getDevice(deviceId),
    REFRESH_INTERVAL_MS,
    [deviceId],
  )

  // Keyed by ieee address, not friendly name: renaming the device must not
  // detach it from its own telemetry.
  const { data: latest } = usePolling(
    () => getLatestTelemetry(device?.ieeeAddress ?? ''),
    REFRESH_INTERVAL_MS,
    [device?.ieeeAddress],
  )

  const allFields = latest ? Object.keys(latest.values) : []
  const hasContact = allFields.includes('contact')
  const chartFields = sortFieldsForDisplay(allFields.filter((f) => f !== 'contact'))

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

  const handleStartEdit = () => {
    if (!device) return
    setForm({ friendlyName: device.friendlyName, type: device.type })
    setEditError(null)
    setEditing(true)
  }

  const handleCancelEdit = () => {
    setEditing(false)
    setForm(null)
    setEditError(null)
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!device || !form) return
    setEditError(null)
    setSaving(true)
    try {
      await updateDevice(device.id, form)
      await refreshDevice()
      setEditing(false)
      setForm(null)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save device')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!device) return
    if (!window.confirm(`Delete "${device.friendlyName}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await deleteDevice(device.id)
      navigate('/devices')
    } finally {
      setDeleting(false)
    }
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
        back={{ to: '/devices', label: 'Devices' }}
        actions={
          <>
            <span
              className={`rounded-full border px-3 py-1 text-sm ${
                device.available
                  ? 'border-ok/40 bg-ok/10 text-ok'
                  : 'border-line text-ink-faint'
              }`}
            >
              {device.available ? 'Online' : 'Offline'}
            </span>
            {!editing && (
              <Button variant="neutral" onClick={handleStartEdit}>
                Edit
              </Button>
            )}
            <Button variant="danger" disabled={deleting} onClick={handleDelete}>
              Delete
            </Button>
          </>
        }
      />

      {editing && form && (
        <form
          onSubmit={handleSaveEdit}
          className="mt-4 max-w-md space-y-4 rounded-2xl border border-line bg-surface-raised p-4"
        >
          <div>
            <label htmlFor="friendlyName" className={labelClasses}>
              Friendly name
            </label>
            <input
              id="friendlyName"
              type="text"
              required
              value={form.friendlyName}
              onChange={(e) => setForm({ ...form, friendlyName: e.target.value })}
              className={`w-full ${fieldClasses}`}
            />
          </div>

          <div>
            <label htmlFor="type" className={labelClasses}>
              Type
            </label>
            <select
              id="type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as DeviceType })}
              className={`w-full ${fieldClasses}`}
            >
              {DEVICE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {editError && <p className="text-danger">{editError}</p>}

          <div className="flex gap-3">
            <Button type="submit" variant="primary" disabled={saving}>
              Save Changes
            </Button>
            <Button type="button" variant="neutral" disabled={saving} onClick={handleCancelEdit}>
              Cancel
            </Button>
          </div>
        </form>
      )}

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

      {(hasContact || chartFields.length > 0) && (
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

          {hasContact && (
            <div className="mb-6">
              <ContactTimelineCard
                deviceKey={device.ieeeAddress}
                range={range}
                currentValue={latest?.values.contact}
              />
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
      )}
    </div>
  )
}
