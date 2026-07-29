import { Button } from '@/ui/Button'
import { fieldClasses } from '@/ui/field'
import type { IngredientInput, IngredientUnit } from '../types/recipe'

const UNITS: IngredientUnit[] = ['G', 'KG', 'ML', 'L', 'TSP', 'TBSP', 'CUP', 'FL_OZ', 'OZ', 'LB', 'PINCH']

const EMPTY_INGREDIENT: IngredientInput = { name: '', amount: 0, unit: null }

const compactField = `${fieldClasses} px-3 py-2`

export function IngredientListEditor({
  value,
  onChange,
}: {
  value: IngredientInput[]
  onChange: (value: IngredientInput[]) => void
}) {
  const update = (index: number, patch: Partial<IngredientInput>) => {
    onChange(value.map((ingredient, i) => (i === index ? { ...ingredient, ...patch } : ingredient)))
  }

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= value.length) return
    const next = [...value]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {value.map((ingredient, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="text"
            value={ingredient.name}
            onChange={(e) => update(index, { name: e.target.value })}
            placeholder="Ingredient name"
            className={`flex-1 ${compactField}`}
          />
          <input
            type="number"
            step="any"
            value={ingredient.amount}
            onChange={(e) => update(index, { amount: Number(e.target.value) })}
            placeholder="Amount"
            className={`w-24 font-mono ${compactField}`}
          />
          <select
            value={ingredient.unit ?? ''}
            onChange={(e) => update(index, { unit: (e.target.value || null) as IngredientUnit | null })}
            className={compactField}
          >
            <option value="">–</option>
            {UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">
            ↑
          </Button>
          <Button
            size="sm"
            onClick={() => move(index, 1)}
            disabled={index === value.length - 1}
            aria-label="Move down"
          >
            ↓
          </Button>
          <Button size="sm" variant="danger" onClick={() => remove(index)} aria-label="Remove ingredient">
            ✕
          </Button>
        </div>
      ))}
      <Button size="sm" onClick={() => onChange([...value, { ...EMPTY_INGREDIENT }])}>
        + Add ingredient
      </Button>
    </div>
  )
}
