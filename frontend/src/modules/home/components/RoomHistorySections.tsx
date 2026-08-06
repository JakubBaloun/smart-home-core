import { usePolling } from '@/hooks/usePolling'
import { getLatestTelemetry } from '@/modules/devices/api/telemetry'
import { ContactTimelineCard } from '@/modules/devices/components/ContactTimelineCard'
import { StateTimelineCard } from '@/modules/devices/components/StateTimelineCard'
import { TelemetryFieldChart } from '@/modules/devices/components/TelemetryFieldChart'
import type { Device } from '@/modules/devices/types/device'
import type { LatestTelemetryResponse, TimeRange } from '@/modules/devices/types/telemetry'

const REFRESH_INTERVAL_MS = 15_000

type SectionKind = 'temperature' | 'humidity' | 'contact' | 'state'

interface Section {
  key: string
  kind: SectionKind
  device: Device
  latest: LatestTelemetryResponse | null
}

const SECTION_ORDER: SectionKind[] = ['temperature', 'humidity', 'contact', 'state']

const FIELD_LABEL: Record<SectionKind, string> = {
  temperature: 'teplota',
  humidity: 'vlhkost',
  contact: 'kontakt',
  state: 'stav',
}

function useDeviceLatest(devices: Device[]) {
  return usePolling(
    () => Promise.all(devices.map((d) => getLatestTelemetry(d.ieeeAddress).catch(() => null))),
    REFRESH_INTERVAL_MS,
    [devices.map((d) => d.ieeeAddress).join(',')],
  )
}

export function RoomHistorySections({ devices, range }: { devices: Device[]; range: TimeRange }) {
  const { data: latestByDevice } = useDeviceLatest(devices)

  const sections: Section[] = []
  devices.forEach((device, i) => {
    const latest = latestByDevice?.[i] ?? null
    if (device.type === 'SENSOR') {
      if (latest && typeof latest.values.temperature === 'number') {
        sections.push({ key: `${device.id}-temperature`, kind: 'temperature', device, latest })
      }
      if (latest && typeof latest.values.humidity === 'number') {
        sections.push({ key: `${device.id}-humidity`, kind: 'humidity', device, latest })
      }
      if (latest && typeof latest.values.contact === 'number') {
        sections.push({ key: `${device.id}-contact`, kind: 'contact', device, latest })
      }
    }
    if (device.type === 'LIGHT' || device.type === 'SWITCH' || device.type === 'PLUG') {
      if (latest && typeof latest.values?.state === 'number') {
        sections.push({ key: `${device.id}-state`, kind: 'state', device, latest })
      }
    }
  })

  sections.sort((a, b) => SECTION_ORDER.indexOf(a.kind) - SECTION_ORDER.indexOf(b.kind))

  return (
    <div className="mt-6 flex flex-col gap-6">
      {sections.map((section) => (
        <section key={section.key}>
          <h3 className="mb-2 text-sm text-ink-muted">
            {section.device.friendlyName} · {FIELD_LABEL[section.kind]}
          </h3>
          {section.kind === 'temperature' && (
            <TelemetryFieldChart deviceKey={section.device.ieeeAddress} field="temperature" range={range} />
          )}
          {section.kind === 'humidity' && (
            <TelemetryFieldChart deviceKey={section.device.ieeeAddress} field="humidity" range={range} />
          )}
          {section.kind === 'contact' && (
            <ContactTimelineCard
              deviceKey={section.device.ieeeAddress}
              range={range}
              currentValue={section.latest?.values.contact}
            />
          )}
          {section.kind === 'state' && (
            <StateTimelineCard
              deviceKey={section.device.ieeeAddress}
              range={range}
              currentValue={section.latest?.values.state}
            />
          )}
        </section>
      ))}
    </div>
  )
}
