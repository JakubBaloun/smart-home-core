import { ContactTimelineCard } from '@/modules/devices/components/ContactTimelineCard'
import { TelemetryFieldChart } from '@/modules/devices/components/TelemetryFieldChart'
import type { TimeRange } from '@/modules/devices/types/telemetry'
import { Button } from '@/ui/Button'

function formatMetricValue(field: string, value: number): string {
  if (field === 'temperature') return `${value.toFixed(1)}°C`
  if (field === 'humidity') return `${Math.round(value)}%`
  return `${value}`
}

export type RoomWidgetProps =
  | {
      kind: 'metric'
      field: string
      deviceKey: string
      label: string
      range: TimeRange
      showGraph: boolean
      value: number
    }
  | {
      kind: 'contact'
      deviceKey: string
      label: string
      range: TimeRange
      showGraph: boolean
      value: number
    }
  | {
      kind: 'state'
      label: string
      value: 'ON' | 'OFF'
      onToggle: () => void
      toggling: boolean
    }

export function RoomWidget(props: RoomWidgetProps) {
  if (props.kind === 'state') {
    return (
      <div className="flex h-full flex-col justify-between rounded-2xl border border-line bg-surface-raised p-4">
        <h3 className="truncate text-sm text-ink-muted">{props.label}</h3>
        <Button
          variant={props.value === 'ON' ? 'primary' : 'neutral'}
          disabled={props.toggling}
          onClick={props.onToggle}
          className="mt-2 w-full"
        >
          {props.value === 'ON' ? 'Zapnuto' : 'Vypnuto'}
        </Button>
      </div>
    )
  }

  if (props.kind === 'contact') {
    return (
      <div className="flex h-full flex-col gap-2">
        <h3 className="truncate text-sm text-ink-muted">{props.label}</h3>
        {props.showGraph ? (
          <ContactTimelineCard deviceKey={props.deviceKey} range={props.range} currentValue={props.value} />
        ) : (
          <span
            className={`inline-block w-fit rounded-full border px-3 py-1 text-sm ${
              props.value === 1
                ? 'border-ok/40 bg-ok/10 text-ok'
                : 'border-danger/40 bg-danger/10 text-danger'
            }`}
          >
            {props.value === 1 ? 'zavřeno' : 'otevřeno'}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <h3 className="truncate text-sm text-ink-muted">{props.label}</h3>
      {props.showGraph ? (
        <TelemetryFieldChart deviceKey={props.deviceKey} field={props.field} range={props.range} />
      ) : (
        <p className="font-mono text-2xl font-semibold tabular-nums text-warm">
          {formatMetricValue(props.field, props.value)}
        </p>
      )}
    </div>
  )
}
