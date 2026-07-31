import type { DeviceReading } from '../api/deviceReadings'
import type { Device } from '../types/device'
import { DeviceCard } from './DeviceCard'

const STAGGER_LIMIT = 12
const STAGGER_STEP_MS = 40

interface Section {
  label: string
  types: Device['type'][]
}

const SECTIONS: Section[] = [
  { label: 'Světla', types: ['LIGHT'] },
  { label: 'Spínače a zásuvky', types: ['SWITCH', 'PLUG'] },
  { label: 'Senzory', types: ['SENSOR'] },
  { label: 'Ostatní', types: ['OTHER'] },
]

export function DeviceGrid({ readings }: { readings: DeviceReading[] }) {
  if (readings.length === 0) {
    return <p className="text-ink-muted">No devices found.</p>
  }

  let cardIndex = 0

  return (
    <div className="flex flex-col gap-6">
      {SECTIONS.map((section) => {
        const sectionReadings = readings.filter((r) => section.types.includes(r.device.type))
        if (sectionReadings.length === 0) return null

        return (
          <div key={section.label}>
            <h2 className="mb-3 border-b border-line pb-2 text-xs tracking-wide text-ink-muted uppercase">
              {section.label}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {sectionReadings.map(({ device, liveValue }) => {
                const delay = cardIndex < STAGGER_LIMIT ? cardIndex * STAGGER_STEP_MS : 0
                cardIndex += 1
                return (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    liveValue={liveValue}
                    style={{ animationDelay: `${delay}ms` }}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
