import { Ring } from '@/ui/Ring'
import { IconCheck } from '@/ui/icons'
import { ServingsToggle } from '../../components/ServingsToggle'
import { formatAmount, scaleAmount } from '../../lib/portionScaling'
import { formatUnit } from '../../lib/units'
import type { RecipeIngredient } from '../../types/recipe'

export function IngredientPanel({
  ingredients,
  servingsBase,
  servings,
  onServingsChange,
  checkedIds,
  onToggle,
  notes,
}: {
  ingredients: RecipeIngredient[]
  servingsBase: number
  servings: number
  onServingsChange: (servings: number) => void
  checkedIds: number[]
  onToggle: (ingredientId: number) => void
  notes?: string | null
}) {
  return (
    <div className="flex flex-col gap-5">
      <ServingsToggle value={servings} onChange={onServingsChange} />

      {ingredients.length === 0 ? (
        <p className="text-ink-muted">No ingredients listed.</p>
      ) : (
        <ul>
          {ingredients.map((ingredient) => {
            const checked = checkedIds.includes(ingredient.id)
            const amount = formatAmount(scaleAmount(ingredient.amount, servingsBase, servings))
            const unit = formatUnit(ingredient.unit)

            return (
              <li key={ingredient.id}>
                <button
                  type="button"
                  aria-pressed={checked}
                  aria-label={[amount, unit, ingredient.name].filter(Boolean).join(' ')}
                  onClick={() => onToggle(ingredient.id)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 text-left transition hover:bg-overlay active:scale-[0.99]"
                >
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-lg border transition ${
                      checked ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong'
                    }`}
                  >
                    {checked && <IconCheck className="size-4" />}
                  </span>
                  <span
                    className={`w-14 shrink-0 text-right font-mono tabular-nums ${
                      checked ? 'text-ink-faint' : 'text-accent'
                    }`}
                  >
                    {amount}
                  </span>
                  <span
                    className={`w-12 shrink-0 font-mono ${checked ? 'text-ink-faint' : 'text-ink-muted'}`}
                  >
                    {unit}
                  </span>
                  <span className={checked ? 'text-ink-faint line-through' : 'text-ink'}>
                    {ingredient.name}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {notes && (
        <div className="border-t border-line pt-4">
          <p className="mb-1 font-mono text-xs tracking-widest text-ink-faint uppercase">Notes</p>
          <p className="whitespace-pre-line text-ink-muted">{notes}</p>
        </div>
      )}
    </div>
  )
}

export function IngredientProgress({
  checkedCount,
  total,
}: {
  checkedCount: number
  total: number
}) {
  return (
    <span className="flex items-center gap-2">
      <Ring
        size={20}
        strokeWidth={5}
        progress={total > 0 ? checkedCount / total : 0}
        className="text-accent"
      />
      <span className="font-mono text-sm text-ink-faint tabular-nums">
        {checkedCount}/{total}
      </span>
    </span>
  )
}
