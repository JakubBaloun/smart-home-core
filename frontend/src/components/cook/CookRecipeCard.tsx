import { Link } from 'react-router-dom'
import type { Recipe } from '../../types/recipe'

export function CookRecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <Link
      to={`/cook/${recipe.id}`}
      className="flex min-h-[160px] flex-col justify-between rounded-2xl border border-gray-800 bg-gray-900 p-6 transition hover:border-gray-600 hover:bg-gray-800 active:scale-[0.98]"
    >
      <div>
        <h3 className="truncate text-xl font-medium text-gray-100">{recipe.title}</h3>
        <p className="mt-2 text-base text-gray-500">
          {recipe.prepTimeMinutes != null && `Prep ${recipe.prepTimeMinutes}m`}
          {recipe.prepTimeMinutes != null && recipe.cookTimeMinutes != null && ' · '}
          {recipe.cookTimeMinutes != null && `Cook ${recipe.cookTimeMinutes}m`}
        </p>
      </div>
      {recipe.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {recipe.tags.map((tag) => (
            <span key={tag.id} className="rounded-full bg-gray-800 px-3 py-1 text-sm text-gray-400">
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}
