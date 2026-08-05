import { useId } from 'react'
import { Area, AreaChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useChartPalette } from '@/app/theme'
import type { TelemetryPoint } from '../types/telemetry'

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function TelemetryChart({
  field,
  points,
  heightClassName = 'h-64',
}: {
  field: string
  points: TelemetryPoint[]
  heightClassName?: string
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
    return (
      <div className={`${heightClassName} w-full font-mono`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={palette.warm} stopOpacity={0.45} />
                <stop offset="95%" stopColor={palette.warm} stopOpacity={0} />
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
              stroke={palette.warm}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className={`${heightClassName} w-full font-mono`}>
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
