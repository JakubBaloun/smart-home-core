const FRACTIONS: [value: number, glyph: string][] = [
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [1 / 2, '½'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
]

const FRACTION_TOLERANCE = 0.015

/** Above this a fraction glyph reads as noise ("312½ g"), so decimals win. */
const FRACTION_LIMIT = 10

export function scaleAmount(amount: number, servingsBase: number, targetServings: number): number {
  if (servingsBase <= 0) return amount
  return amount * (targetServings / servingsBase)
}

export function formatAmount(amount: number): string {
  const rounded = Math.round(amount * 100) / 100

  if (rounded > 0 && rounded < FRACTION_LIMIT) {
    const whole = Math.floor(rounded)
    const fraction = FRACTIONS.find(([value]) => Math.abs(rounded - whole - value) < FRACTION_TOLERANCE)
    if (fraction) return whole > 0 ? `${whole}${fraction[1]}` : fraction[1]
  }

  return String(rounded)
}
