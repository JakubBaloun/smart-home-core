import { useId } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useChartPalette } from '@/app/theme'
import type { TelemetryPoint } from '@/modules/devices/types/telemetry'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function TemperatureChart({ points }: { points: TelemetryPoint[] }) {
  const palette = useChartPalette()
  const gradientId = useId()

  if (points.length === 0) {
    return <p className="text-sm text-ink-muted">No history for this range yet.</p>
  }

  const data = points.map((p) => ({ time: p.time, value: p.value }))

  return (
    <div className="h-40 w-full font-mono">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={palette.series} stopOpacity={0.45} />
              <stop offset="95%" stopColor={palette.series} stopOpacity={0} />
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
            width={34}
            tickFormatter={(v: number) => `${v}°`}
            domain={['auto', 'auto']}
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
            stroke={palette.series}
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
