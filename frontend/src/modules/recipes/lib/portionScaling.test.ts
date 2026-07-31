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
    expect(formatAmount(0)).toBe('0')
  })

  it('renders small amounts as kitchen fractions', () => {
    expect(formatAmount(2.5)).toBe('2½')
    expect(formatAmount(0.25)).toBe('¼')
    expect(formatAmount(1 / 3)).toBe('⅓')
    expect(formatAmount(2 / 3)).toBe('⅔')
    expect(formatAmount(1.75)).toBe('1¾')
  })

  it('keeps decimals for larger amounts, where a fraction glyph reads as noise', () => {
    expect(formatAmount(12.5)).toBe('12.5')
    expect(formatAmount(312.5)).toBe('312.5')
  })
})
