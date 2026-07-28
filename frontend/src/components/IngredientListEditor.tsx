import type { IngredientInput, IngredientUnit } from '../types/recipe'

const UNITS: IngredientUnit[] = ['G', 'KG', 'ML', 'L', 'TSP', 'TBSP', 'CUP', 'FL_OZ', 'OZ', 'LB', 'PINCH']

const EMPTY_INGREDIENT: IngredientInput = { name: '', amount: 0, unit: null }

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
            className="flex-1 rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-gray-100 placeholder-gray-600 focus:border-purple-600 focus:outline-none"
          />
          <input
            type="number"
            step="any"
            value={ingredient.amount}
            onChange={(e) => update(index, { amount: Number(e.target.value) })}
            placeholder="Amount"
            className="w-24 rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-gray-100 placeholder-gray-600 focus:border-purple-600 focus:outline-none"
          />
          <select
            value={ingredient.unit ?? ''}
            onChange={(e) => update(index, { unit: (e.target.value || null) as IngredientUnit | null })}
            className="rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-gray-100 focus:border-purple-600 focus:outline-none"
          >
            <option value="">–</option>
            {UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => move(index, -1)}
            disabled={index === 0}
            className="rounded-lg bg-gray-800 px-2 py-2 text-gray-400 hover:bg-gray-700 disabled:opacity-30"
            aria-label="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => move(index, 1)}
            disabled={index === value.length - 1}
            className="rounded-lg bg-gray-800 px-2 py-2 text-gray-400 hover:bg-gray-700 disabled:opacity-30"
            aria-label="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => remove(index)}
            className="rounded-lg bg-gray-800 px-2 py-2 text-red-400 hover:bg-gray-700"
            aria-label="Remove ingredient"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, { ...EMPTY_INGREDIENT }])}
        className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
      >
        + Add ingredient
      </button>
    </div>
  )
}
