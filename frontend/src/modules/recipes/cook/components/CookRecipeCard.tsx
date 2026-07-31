import { Link } from 'react-router-dom'
import { Chip } from '@/ui/Chip'
import { IconClock, IconServing } from '@/ui/icons'
import { formatTotalTime } from '../../lib/units'
import type { Recipe } from '../../types/recipe'

export function CookRecipeCard({ recipe }: { recipe: Recipe }) {
  const totalTime = formatTotalTime(recipe.prepTimeMinutes, recipe.cookTimeMinutes)

  return (
    <Link
      to={`/cook/${recipe.id}`}
      className="flex min-h-44 flex-col justify-between gap-4 rounded-2xl border border-line bg-surface-raised p-6 transition hover:border-accent hover:bg-overlay active:scale-[0.98]"
    >
      <h3 className="font-display text-2xl font-medium tracking-tight text-ink">{recipe.title}</h3>

      <div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-sm text-ink-muted tabular-nums">
          {totalTime && (
            <span className="inline-flex items-center gap-1.5">
              <IconClock className="size-4 text-ink-faint" />
              {totalTime}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <IconServing className="size-4 text-ink-faint" />
            {recipe.servingsBase}
          </span>
        </div>

        {recipe.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {recipe.tags.map((tag) => (
              <Chip key={tag.id}>{tag.name}</Chip>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
