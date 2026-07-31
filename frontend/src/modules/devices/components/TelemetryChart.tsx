import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useChartPalette } from '@/app/theme'
import type { TelemetryPoint } from '../types/telemetry'

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function TelemetryChart({ field, points }: { field: string; points: TelemetryPoint[] }) {
  const palette = useChartPalette()

  if (points.length === 0) {
    return <p className="text-sm text-ink-muted">No data for "{field}" in this range.</p>
  }

  const data = points.map((p) => ({ time: p.time, value: p.value }))
  const seriesColor = field.toLowerCase().includes('temp') ? palette.warm : palette.series

  return (
    <div className="h-64 w-full font-mono">
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
