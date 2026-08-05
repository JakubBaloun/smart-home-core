import { describe, expect, it } from 'vitest'
import { formatChartTime } from './chartTime'

describe('formatChartTime', () => {
  it('formats hour:minute only for ranges under 7d', () => {
    const d = new Date('2026-08-05T14:05:00Z')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    expect(formatChartTime('2026-08-05T14:05:00Z', '1h')).toBe(`${hh}:${mm}`)
  })

  it('prefixes day.month for the 7d range', () => {
    const d = new Date('2026-08-03T09:07:00Z')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    expect(formatChartTime('2026-08-03T09:07:00Z', '7d')).toBe(`${d.getDate()}.${d.getMonth() + 1} ${hh}:${mm}`)
  })
})
