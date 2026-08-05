import React from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@/app/theme'
import { TelemetryChart } from './TelemetryChart'
import type { TelemetryPoint } from '../types/telemetry'

vi.mock('recharts', async () => {
  const original = await vi.importActual<typeof import('recharts')>('recharts')
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
      React.cloneElement(children, { width: 800, height: 400 }),
  }
})

const SAMPLE_POINTS: TelemetryPoint[] = [
  { time: '2026-08-01T10:00:00Z', value: 22.5 },
  { time: '2026-08-01T11:00:00Z', value: 45.0 },
]

function mockMatchMedia() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
}

describe('TelemetryChart', () => {
  beforeEach(() => {
    mockMatchMedia()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders a no data message when points array is empty', () => {
    render(<TelemetryChart field="humidity" points={[]} />)
    expect(screen.getByText('No data for "humidity" in this range.')).toBeInTheDocument()
  })

  it('renders temperature area chart with SVG gradient stops', () => {
    const { container } = render(
      <ThemeProvider>
        <TelemetryChart field="temperature" points={SAMPLE_POINTS} />
      </ThemeProvider>,
    )
    const linearGradient = container.querySelector('linearGradient')
    expect(linearGradient).toBeInTheDocument()
    const stops = container.querySelectorAll('stop')
    expect(stops.length).toBeGreaterThan(0)
  })

  it('renders humidity area chart with SVG gradient limit zones', () => {
    const { container } = render(
      <ThemeProvider>
        <TelemetryChart field="humidity" points={SAMPLE_POINTS} />
      </ThemeProvider>,
    )
    const linearGradient = container.querySelector('linearGradient')
    expect(linearGradient).toBeInTheDocument()
    const stops = Array.from(container.querySelectorAll('stop'))
    const offsets = stops.map((s) => s.getAttribute('offset'))
    expect(offsets).toContain('0%')
    expect(offsets).toContain('39.4%')
    expect(offsets).toContain('40.6%')
    expect(offsets).toContain('49.4%')
    expect(offsets).toContain('50.6%')
    expect(offsets).toContain('59.4%')
    expect(offsets).toContain('60.6%')
    expect(offsets).toContain('69.4%')
    expect(offsets).toContain('70.6%')
    expect(offsets).toContain('100%')
  })

  it('renders standard line chart for non-temperature non-humidity fields', () => {
    const { container } = render(
      <ThemeProvider>
        <TelemetryChart field="battery" points={SAMPLE_POINTS} />
      </ThemeProvider>,
    )
    const linearGradient = container.querySelector('linearGradient')
    expect(linearGradient).toBeNull()
  })
})
