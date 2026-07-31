import { Link } from 'react-router-dom'
import { Chip } from '@/ui/Chip'
import { IconClock, IconServing } from '@/ui/icons'
import { formatTotalTime } from '../lib/units'
import type { Recipe } from '../types/recipe'

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const totalTime = formatTotalTime(recipe.prepTimeMinutes, recipe.cookTimeMinutes)

  return (
    <Link
      to={`/recipes/${recipe.id}`}
      className="flex min-h-32 flex-col justify-between gap-3 rounded-2xl border border-line bg-surface-raised p-5 transition hover:border-accent hover:bg-overlay active:scale-[0.98]"
    >
      <h3 className="font-display text-lg font-medium text-ink">{recipe.title}</h3>

      <div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-ink-muted tabular-nums">
          {totalTime && (
            <span className="inline-flex items-center gap-1">
              <IconClock className="size-3.5 text-ink-faint" />
              {totalTime}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <IconServing className="size-3.5 text-ink-faint" />
            {recipe.servingsBase}
          </span>
        </div>

        {recipe.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {recipe.tags.map((tag) => (
              <Chip key={tag.id} className="px-2 py-0.5 text-xs">
                {tag.name}
              </Chip>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
