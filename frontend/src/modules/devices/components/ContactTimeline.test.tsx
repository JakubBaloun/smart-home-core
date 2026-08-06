import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ContactTimeline } from './ContactTimeline'
import type { TelemetryPoint } from '../types/telemetry'

const FROM = new Date('2026-08-01T00:00:00Z').getTime()
const TO = new Date('2026-08-01T01:00:00Z').getTime()

describe('ContactTimeline', () => {
  it('shows a closed badge and no transitions when the state never changes', () => {
    const points: TelemetryPoint[] = [{ time: '2026-08-01T00:10:00Z', value: 1 }]

    render(<ContactTimeline points={points} fromMs={FROM} toMs={TO} currentValue={1} />)

    expect(screen.getByText('zavřeno')).toBeInTheDocument()
    expect(screen.getByText('Beze změny v tomto rozsahu')).toBeInTheDocument()
  })

  it('shows an open badge when currentValue is 0', () => {
    const points: TelemetryPoint[] = [{ time: '2026-08-01T00:10:00Z', value: 0 }]

    render(<ContactTimeline points={points} fromMs={FROM} toMs={TO} currentValue={0} />)

    expect(screen.getByText('otevřeno')).toBeInTheDocument()
  })

  it('lists recent transitions with a duration when the state changes', () => {
    const points: TelemetryPoint[] = [
      { time: '2026-08-01T00:10:00Z', value: 1 },
      { time: '2026-08-01T00:29:00Z', value: 0 },
      { time: '2026-08-01T00:31:00Z', value: 1 },
    ]

    render(<ContactTimeline points={points} fromMs={FROM} toMs={TO} currentValue={1} />)

    expect(screen.getByText(/otevřeno \(2 min\)/)).toBeInTheDocument()
  })

  it('falls back to the last point when currentValue is not given', () => {
    const points: TelemetryPoint[] = [
      { time: '2026-08-01T00:10:00Z', value: 1 },
      { time: '2026-08-01T00:20:00Z', value: 0 },
    ]

    render(<ContactTimeline points={points} fromMs={FROM} toMs={TO} />)

    expect(screen.getByText('otevřeno')).toBeInTheDocument()
  })

  it('shows a no-data message when there are no points and no currentValue', () => {
    render(<ContactTimeline points={[]} fromMs={FROM} toMs={TO} />)

    expect(screen.getByText('No data for "contact" in this range.')).toBeInTheDocument()
  })

  it('renders custom labels and a custom no-data message', () => {
    render(
      <ContactTimeline
        points={[]}
        fromMs={FROM}
        toMs={TO}
        field="state"
        isActive={(v) => v === 1}
        activeLabel="zapnuto"
        inactiveLabel="vypnuto"
        activeBadgeClass="border-accent/40 bg-accent/10 text-accent"
        inactiveBadgeClass="border-line bg-surface-sunken text-ink-muted"
        activeBarClass="bg-accent"
        inactiveBarClass="bg-surface-sunken"
      />,
    )

    expect(screen.getByText('No data for "state" in this range.')).toBeInTheDocument()
  })

  it('renders the active custom label and bar color when currentValue is active', () => {
    const points: TelemetryPoint[] = [{ time: '2026-08-01T00:10:00Z', value: 1 }]

    const { container } = render(
      <ContactTimeline
        points={points}
        fromMs={FROM}
        toMs={TO}
        currentValue={1}
        activeLabel="zapnuto"
        inactiveLabel="vypnuto"
        activeBarClass="bg-accent"
        inactiveBarClass="bg-surface-sunken"
      />,
    )

    expect(screen.getByText('zapnuto')).toBeInTheDocument()
    expect(container.querySelector('.bg-accent')).not.toBeNull()
  })

  it('lists a transition using the custom labels', () => {
    const points: TelemetryPoint[] = [
      { time: '2026-08-01T00:10:00Z', value: 1 },
      { time: '2026-08-01T00:29:00Z', value: 0 },
      { time: '2026-08-01T00:31:00Z', value: 1 },
    ]

    render(
      <ContactTimeline
        points={points}
        fromMs={FROM}
        toMs={TO}
        currentValue={1}
        activeLabel="zapnuto"
        inactiveLabel="vypnuto"
      />,
    )

    expect(screen.getByText(/vypnuto \(2 min\)/)).toBeInTheDocument()
  })
})
