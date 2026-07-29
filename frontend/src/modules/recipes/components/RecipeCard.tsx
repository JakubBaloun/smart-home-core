import { Link } from 'react-router-dom'
import { Chip } from '@/ui/Chip'
import type { Recipe } from '../types/recipe'

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <Link
      to={`/recipes/${recipe.id}`}
      className="flex min-h-[120px] flex-col justify-between rounded-2xl border border-line bg-surface-raised p-5 transition hover:border-line-strong hover:bg-overlay active:scale-[0.98]"
    >
      <div>
        <h3 className="truncate font-display text-lg font-medium text-ink">{recipe.title}</h3>
        <p className="mt-1 font-mono text-xs text-ink-faint">
          {recipe.prepTimeMinutes != null && `Prep ${recipe.prepTimeMinutes}m`}
          {recipe.prepTimeMinutes != null && recipe.cookTimeMinutes != null && ' · '}
          {recipe.cookTimeMinutes != null && `Cook ${recipe.cookTimeMinutes}m`}
        </p>
      </div>
      {recipe.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {recipe.tags.map((tag) => (
            <Chip key={tag.id} className="px-2 py-0.5 text-xs">
              {tag.name}
            </Chip>
          ))}
        </div>
      )}
    </Link>
  )
}
