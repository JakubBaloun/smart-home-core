import { describe, expect, it } from 'vitest'
import { formatAmount, scaleAmount } from './portionScaling'

describe('scaleAmount', () => {
  it('scales proportionally to the target servings', () => {
    expect(scaleAmount(100, 4, 8)).toBe(200)
    expect(scaleAmount(100, 4, 2)).toBe(50)
  })

  it('returns the amount unchanged when servingsBase is not positive', () => {
    expect(scaleAmount(100, 0, 8)).toBe(100)
    expect(scaleAmount(100, -1, 8)).toBe(100)
  })
})

describe('formatAmount', () => {
  it('rounds to two decimal places', () => {
    expect(formatAmount(1.005)).toBe('1')
    expect(formatAmount(1.23456)).toBe('1.23')
  })

  it('strips trailing zeros', () => {
    expect(formatAmount(2)).toBe('2')
    expect(formatAmount(2.5)).toBe('2.5')
  })
})
