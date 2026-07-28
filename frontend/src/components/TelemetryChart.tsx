import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TelemetryPoint } from '../types/telemetry'

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function TelemetryChart({ field, points }: { field: string; points: TelemetryPoint[] }) {
  if (points.length === 0) {
    return <p className="text-sm text-gray-500">No data for "{field}" in this range.</p>
  }

  const data = points.map((p) => ({ time: p.time, value: p.value }))

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="time" tickFormatter={formatTime} stroke="#6b7280" fontSize={12} />
          <YAxis stroke="#6b7280" fontSize={12} />
          <Tooltip
            labelFormatter={(label) => formatTime(label as string)}
            contentStyle={{ background: '#1f2028', border: '1px solid #374151', color: '#e5e7eb' }}
          />
          <Line type="monotone" dataKey="value" stroke="#c084fc" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
