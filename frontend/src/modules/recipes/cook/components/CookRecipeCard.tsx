import { Link } from 'react-router-dom'
import { Chip } from '@/ui/Chip'
import type { Recipe } from '../../types/recipe'

export function CookRecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <Link
      to={`/cook/${recipe.id}`}
      className="flex min-h-[160px] flex-col justify-between rounded-2xl border border-line bg-surface-raised p-6 transition hover:border-line-strong hover:bg-overlay active:scale-[0.98]"
    >
      <div>
        <h3 className="truncate font-display text-xl font-medium text-ink">{recipe.title}</h3>
        <p className="mt-2 font-mono text-sm text-ink-faint">
          {recipe.prepTimeMinutes != null && `Prep ${recipe.prepTimeMinutes}m`}
          {recipe.prepTimeMinutes != null && recipe.cookTimeMinutes != null && ' · '}
          {recipe.cookTimeMinutes != null && `Cook ${recipe.cookTimeMinutes}m`}
        </p>
      </div>
      {recipe.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {recipe.tags.map((tag) => (
            <Chip key={tag.id}>{tag.name}</Chip>
          ))}
        </div>
      )}
    </Link>
  )
}
