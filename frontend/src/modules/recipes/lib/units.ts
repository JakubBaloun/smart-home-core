import type { IngredientUnit } from '../types/recipe'

const UNIT_LABELS: Record<IngredientUnit, string> = {
  G: 'g',
  KG: 'kg',
  ML: 'ml',
  L: 'l',
  TSP: 'tsp',
  TBSP: 'tbsp',
  CUP: 'cup',
  FL_OZ: 'fl oz',
  OZ: 'oz',
  LB: 'lb',
  PINCH: 'pinch',
}

export function formatUnit(unit: IngredientUnit | null): string {
  return unit ? UNIT_LABELS[unit] : ''
}

export function formatTotalTime(prepMinutes: number | null, cookMinutes: number | null): string | null {
  const total = (prepMinutes ?? 0) + (cookMinutes ?? 0)
  if (total === 0) return null
  if (total < 60) return `${total} min`

  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`
}
