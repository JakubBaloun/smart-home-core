import { describe, expect, it } from 'vitest'
import { formatTotalTime, formatUnit } from './units'

describe('formatUnit', () => {
  it('renders wire units as kitchen labels', () => {
    expect(formatUnit('G')).toBe('g')
    expect(formatUnit('TBSP')).toBe('tbsp')
    expect(formatUnit('FL_OZ')).toBe('fl oz')
  })

  it('renders nothing for a countable ingredient', () => {
    expect(formatUnit(null)).toBe('')
  })
})

describe('formatTotalTime', () => {
  it('sums prep and cook time', () => {
    expect(formatTotalTime(10, 20)).toBe('30 min')
  })

  it('tolerates a missing half', () => {
    expect(formatTotalTime(null, 20)).toBe('20 min')
    expect(formatTotalTime(15, null)).toBe('15 min')
  })

  it('switches to hours past an hour', () => {
    expect(formatTotalTime(20, 40)).toBe('1 h')
    expect(formatTotalTime(30, 60)).toBe('1 h 30 min')
  })

  it('returns null when no time is recorded', () => {
    expect(formatTotalTime(null, null)).toBeNull()
  })
})
