import { useId } from 'react'
import { Area, AreaChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useChartPalette } from '@/app/theme'
import type { TelemetryPoint } from '../types/telemetry'

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const TEMP_MARGIN = { top: 8, right: 4, left: 0, bottom: 0 }

export function TelemetryChart({
  field,
  points,
  heightPx = 256,
}: {
  field: string
  points: TelemetryPoint[]
  heightPx?: number
}) {
  const palette = useChartPalette()
  const gradientId = useId()

  if (points.length === 0) {
    return <p className="text-sm text-ink-muted">No data for "{field}" in this range.</p>
  }

  const data = points.map((p) => ({ time: p.time, value: p.value }))
  const isTemperature = field.toLowerCase().includes('temp')
  const seriesColor = isTemperature ? palette.warm : palette.series

  // Temperature gets a fixed indoor range and °C formatting so the curve's position is
  // comparable across visits. Assumes all sensors are indoor; revisit if an outdoor
  // sensor is ever added.
  if (isTemperature) {
    // Gradient is pinned to the fixed [14, 32] domain (in plot pixels, not the data's own
    // bounding box) so color always reflects the actual temperature, not just today's range.
    const plotHeight = heightPx - TEMP_MARGIN.top - TEMP_MARGIN.bottom
    return (
      <div style={{ height: heightPx }} className="w-full font-mono">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={TEMP_MARGIN}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2={plotHeight} gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={palette.warm} />
                <stop offset="100%" stopColor={palette.series} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tickFormatter={formatTime}
              stroke={palette.axis}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              minTickGap={32}
            />
            <YAxis
              stroke={palette.axis}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v: number) => `${v}°`}
              domain={[14, 32]}
              ticks={[14, 20, 26, 32]}
            />
            <Tooltip
              labelFormatter={(label) => formatTime(label as string)}
              formatter={(value) => [`${Number(value).toFixed(1)} °C`, 'Temperature']}
              contentStyle={{
                background: palette.tooltipBg,
                border: `1px solid ${palette.tooltipBorder}`,
                borderRadius: '0.75rem',
                color: palette.tooltipInk,
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={`url(#${gradientId})`}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              fillOpacity={0.35}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div style={{ height: heightPx }} className="w-full font-mono">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 8 }}>
          <XAxis dataKey="time" tickFormatter={formatTime} stroke={palette.axis} fontSize={12} />
          <YAxis stroke={palette.axis} fontSize={12} width={48} />
          <Tooltip
            labelFormatter={(label) => formatTime(label as string)}
            contentStyle={{
              background: palette.tooltipBg,
              border: `1px solid ${palette.tooltipBorder}`,
              borderRadius: '0.75rem',
              color: palette.tooltipInk,
            }}
          />
          <Line type="monotone" dataKey="value" stroke={seriesColor} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
