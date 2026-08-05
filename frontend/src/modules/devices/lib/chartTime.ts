import type { TimeRange } from '../types/telemetry'

export function formatChartTime(iso: string, range: TimeRange): string {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  if (range !== '7d') return `${hh}:${mm}`
  return `${d.getDate()}.${d.getMonth() + 1} ${hh}:${mm}`
}
