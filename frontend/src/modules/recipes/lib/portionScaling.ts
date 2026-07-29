export function scaleAmount(amount: number, servingsBase: number, targetServings: number): number {
  if (servingsBase <= 0) return amount
  return amount * (targetServings / servingsBase)
}

export function formatAmount(amount: number): string {
  return String(Math.round(amount * 100) / 100)
}
