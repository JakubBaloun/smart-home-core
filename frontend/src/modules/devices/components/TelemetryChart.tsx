import { useId } from 'react'
import { Area, AreaChart, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useChartPalette } from '@/app/theme'
import { formatChartTime } from '../lib/chartTime'
import type { TelemetryPoint, TimeRange } from '../types/telemetry'

const TEMP_MARGIN = { top: 8, right: 4, left: 0, bottom: 0 }

export function TelemetryChart({
  field,
  points,
  range = '24h',
  heightPx = 256,
}: {
  field: string
  points: TelemetryPoint[]
  range?: TimeRange
  heightPx?: number
}) {
  const palette = useChartPalette()
  const gradientId = useId()

  if (points.length === 0) {
    return <p className="text-sm text-ink-muted">No data for "{field}" in this range.</p>
  }

  const data = points.map((p) => ({ time: p.time, value: p.value }))
  const isTemperature = field.toLowerCase().includes('temp')
  const isHumidity = field.toLowerCase().includes('humid')
  const seriesColor = isTemperature ? palette.warm : palette.series

  if (isHumidity) {
    const plotHeight = heightPx - TEMP_MARGIN.top - TEMP_MARGIN.bottom
    return (
      <div style={{ height: heightPx }} className="w-full font-mono">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={TEMP_MARGIN}>
            <defs>
              {/* Anchored to fixed [0, 100]% domain:
                  >60%: Red (danger)
                  50-60%: Orange (warm)
                  40-50%: Dark green (okDark)
                  30-40%: Light green (ok)
                  <30%: Blue (accent) */}
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2={plotHeight} gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={palette.danger} />
                <stop offset="39.4%" stopColor={palette.danger} />
                <stop offset="40.6%" stopColor={palette.warm} />
                <stop offset="49.4%" stopColor={palette.warm} />
                <stop offset="50.6%" stopColor={palette.okDark} />
                <stop offset="59.4%" stopColor={palette.okDark} />
                <stop offset="60.6%" stopColor={palette.ok} />
                <stop offset="69.4%" stopColor={palette.ok} />
                <stop offset="70.6%" stopColor={palette.accent} />
                <stop offset="100%" stopColor={palette.accent} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tickFormatter={(iso: string) => formatChartTime(iso, range)}
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
              tickFormatter={(v: number) => `${v}%`}
              domain={[0, 100]}
              ticks={[0, 20, 40, 60, 80, 100]}
            />
            <Tooltip
              labelFormatter={(label) => formatChartTime(label as string, range)}
              formatter={(value) => [`${Number(value).toFixed(1)} %`, 'Humidity']}
              contentStyle={{
                background: palette.tooltipBg,
                border: `1px solid ${palette.tooltipBorder}`,
                borderRadius: '0.75rem',
                color: palette.tooltipInk,
              }}
            />
            {/* Full-height background tint showing all limit zones across the whole plot height */}
            <ReferenceArea y1={0} y2={100} fill={`url(#${gradientId})`} fillOpacity={0.12} stroke="none" />
            <Area
              type="monotone"
              dataKey="value"
              stroke={seriesColor}
              strokeWidth={2.5}
              fill={seriesColor}
              fillOpacity={0.15}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

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
              {/* Anchored to the fixed [14, 32] domain, not data range. Bands follow how a
                  bedroom actually feels: <17 cold, 17-19 cool, 19-22 ideal, 22-25 warm,
                  25-28 hot, >28 extreme. Each band holds a near-solid color, with a short
                  blend at the boundary — avoids the muddy mid-tones a straight linear
                  interpolation produces between far-apart hues (e.g. green/amber). */}
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2={plotHeight} gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={palette.extreme} />
                <stop offset="21.6%" stopColor={palette.extreme} />
                <stop offset="22.8%" stopColor={palette.danger} />
                <stop offset="38.3%" stopColor={palette.danger} />
                <stop offset="39.5%" stopColor={palette.warm} />
                <stop offset="55%" stopColor={palette.warm} />
                <stop offset="56.2%" stopColor={palette.ok} />
                <stop offset="71.6%" stopColor={palette.ok} />
                <stop offset="72.8%" stopColor={palette.series} />
                <stop offset="82.7%" stopColor={palette.series} />
                <stop offset="83.9%" stopColor={palette.accent} />
                <stop offset="100%" stopColor={palette.accent} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tickFormatter={(iso: string) => formatChartTime(iso, range)}
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
              labelFormatter={(label) => formatChartTime(label as string, range)}
              formatter={(value) => [`${Number(value).toFixed(1)} °C`, 'Temperature']}
              contentStyle={{
                background: palette.tooltipBg,
                border: `1px solid ${palette.tooltipBorder}`,
                borderRadius: '0.75rem',
                color: palette.tooltipInk,
              }}
            />
            {/* Full-height background tint showing all temperature bands across the whole plot height */}
            <ReferenceArea y1={14} y2={32} fill={`url(#${gradientId})`} fillOpacity={0.12} stroke="none" />
            <Area
              type="monotone"
              dataKey="value"
              stroke={seriesColor}
              strokeWidth={2.5}
              fill={seriesColor}
              fillOpacity={0.15}
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
          <XAxis
            dataKey="time"
            tickFormatter={(iso: string) => formatChartTime(iso, range)}
            stroke={palette.axis}
            fontSize={12}
            minTickGap={32}
          />
          <YAxis stroke={palette.axis} fontSize={12} width={48} />
          <Tooltip
            labelFormatter={(label) => formatChartTime(label as string, range)}
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
