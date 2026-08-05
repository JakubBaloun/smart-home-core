import { useRef, useState } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import type { ResponsiveLayouts } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { usePolling } from '@/hooks/usePolling'
import { sendCommand } from '@/modules/devices/api/devices'
import { getLatestTelemetry } from '@/modules/devices/api/telemetry'
import { filterDiagnosticFields } from '@/modules/devices/lib/fieldOrder'
import type { Device } from '@/modules/devices/types/device'
import type { TimeRange } from '@/modules/devices/types/telemetry'
import { Button } from '@/ui/Button'
import { IconCheck, IconPencil, IconRefreshCcw } from '@/ui/icons'
import { clearRoomTelemetryLayout, loadRoomTelemetryLayout, saveRoomTelemetryLayout } from '../lib/roomLayoutStorage'
import { RoomWidget, type RoomWidgetProps } from './RoomWidget'

const REFRESH_INTERVAL_MS = 15_000
const GRID_BREAKPOINTS = { lg: 1024, md: 768, sm: 640 }
const GRID_COLS = { lg: 10, md: 8, sm: 6 }
const GRID_ROW_HEIGHT = 80
const DEFAULT_WIDGET_COLS = 5
const DEFAULT_WIDGET_UNITS = 2
const GRAPH_MIN_W = 4
const GRAPH_MIN_H = 3

const ResponsiveGridLayout = WidthProvider(Responsive)

interface FieldEntry {
  key: string
  field: string
  deviceKey: string
  label: string
  value: number
}

interface WidgetEntry {
  key: string
  props: RoomWidgetProps
}

export function shouldShowWidgetGraph(layout: { w: number; h: number } | undefined): boolean {
  return layout !== undefined && layout.w >= GRAPH_MIN_W && layout.h >= GRAPH_MIN_H
}

async function getRoomFieldEntries(devices: Device[]): Promise<FieldEntry[]> {
  const results = await Promise.all(
    devices.map(async (device): Promise<FieldEntry[]> => {
      try {
        const latest = await getLatestTelemetry(device.ieeeAddress)
        return filterDiagnosticFields(Object.keys(latest.values)).flatMap((field) => {
          const value = latest.values[field]
          return typeof value === 'number'
            ? [{ key: `${device.ieeeAddress}:${field}`, field, deviceKey: device.ieeeAddress, label: device.friendlyName, value }]
            : []
        })
      } catch {
        return []
      }
    }),
  )
  return results.flat()
}

export function RoomTelemetryWidgets({ roomId, devices, range }: { roomId: string; devices: Device[]; range: TimeRange }) {
  const [editing, setEditing] = useState(false)
  const [layouts, setLayouts] = useState<ResponsiveLayouts | null>(() => loadRoomTelemetryLayout(roomId))
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const suppressNextSaveRef = useRef(false)
  const controllable = devices.filter((device) => ['LIGHT', 'SWITCH', 'PLUG'].includes(device.type))
  const deviceKeys = devices.map((device) => device.ieeeAddress).join(',')
  const { data: fieldEntries } = usePolling(() => getRoomFieldEntries(devices), REFRESH_INTERVAL_MS, [deviceKeys])

  const handleToggle = async (device: Device) => {
    setTogglingId(device.id)
    try {
      await sendCommand(device.id, { command: 'setState', payload: { state: device.state === 'ON' ? 'OFF' : 'ON' } })
    } finally {
      setTogglingId(null)
    }
  }

  const handleLayoutChange = (_current: unknown, allLayouts: ResponsiveLayouts) => {
    setLayouts(allLayouts)
    if (!editing || suppressNextSaveRef.current) {
      suppressNextSaveRef.current = false
      return
    }
    saveRoomTelemetryLayout(roomId, allLayouts)
  }

  const handleReset = () => {
    clearRoomTelemetryLayout(roomId)
    suppressNextSaveRef.current = true
    setLayouts(null)
  }

  const widgets: WidgetEntry[] = [
    ...(fieldEntries ?? []).map((entry): WidgetEntry => ({
      key: entry.key,
      props:
        entry.field === 'contact'
          ? { kind: 'contact', deviceKey: entry.deviceKey, label: entry.label, range, showGraph: false, value: entry.value }
          : {
              kind: 'metric',
              field: entry.field,
              deviceKey: entry.deviceKey,
              label: entry.label,
              range,
              showGraph: false,
              value: entry.value,
            },
    })),
    ...controllable.map((device): WidgetEntry => ({
      key: `${device.ieeeAddress}:state`,
      props: {
        kind: 'state',
        label: device.friendlyName,
        value: device.state ?? 'OFF',
        onToggle: () => handleToggle(device),
        toggling: togglingId === device.id,
      },
    })),
  ]

  if (widgets.length === 0) return <p className="text-ink-muted">Žádná data k zobrazení.</p>

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2">
        {editing && (
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <IconRefreshCcw className="size-4" />
            Resetovat rozložení
          </Button>
        )}
        <Button variant="neutral" size="sm" onClick={() => setEditing((value) => !value)}>
          {editing ? <IconCheck className="size-4" /> : <IconPencil className="size-4" />}
          {editing ? 'Hotovo' : 'Upravit rozložení'}
        </Button>
      </div>

      <ResponsiveGridLayout
        className="layout"
        breakpoints={GRID_BREAKPOINTS}
        cols={GRID_COLS}
        rowHeight={GRID_ROW_HEIGHT}
        layouts={layouts ?? undefined}
        isDraggable={editing}
        isResizable={editing}
        onLayoutChange={handleLayoutChange}
      >
        {widgets.map(({ key, props }, index) => (
          <div
            key={key}
            data-grid={
              layouts
                ? undefined
                : {
                    x: (index % DEFAULT_WIDGET_COLS) * DEFAULT_WIDGET_UNITS,
                    y: Math.floor(index / DEFAULT_WIDGET_COLS) * DEFAULT_WIDGET_UNITS,
                    w: DEFAULT_WIDGET_UNITS,
                    h: DEFAULT_WIDGET_UNITS,
                  }
            }
          >
            <SizedRoomWidget widgetKey={key} layouts={layouts} {...props} />
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  )
}

function SizedRoomWidget({ widgetKey, layouts, ...props }: RoomWidgetProps & { widgetKey: string; layouts: ResponsiveLayouts | null }) {
  if (props.kind === 'state') return <RoomWidget {...props} />

  const layout = layouts?.lg?.find((item) => item.i === widgetKey)
  return <RoomWidget {...props} showGraph={shouldShowWidgetGraph(layout)} />
}
