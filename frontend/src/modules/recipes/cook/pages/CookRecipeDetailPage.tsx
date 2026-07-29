import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePolling } from '@/hooks/usePolling'
import { ButtonLink } from '@/ui/Button'
import { Loading } from '@/ui/Loading'
import { IconChevronLeft } from '@/ui/icons'
import { getRecipe } from '../../api/recipes'
import { ServingsToggle } from '../../components/ServingsToggle'
import { formatAmount, scaleAmount } from '../../lib/portionScaling'

const REFRESH_INTERVAL_MS = 15_000

export function CookRecipeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const recipeId = Number(id)
  const [servings, setServings] = useState<number | null>(null)

  const { data: recipe, error } = usePolling(() => getRecipe(recipeId), REFRESH_INTERVAL_MS, [recipeId])

  if (error) {
    return <p className="p-8 text-xl text-danger">Failed to load recipe: {error.message}</p>
  }

  if (!recipe) {
    return <Loading />
  }

  const targetServings = servings ?? recipe.servingsBase

  return (
    <div className="h-full overflow-y-auto p-8">
      <Link
        to="/cook"
        className="inline-flex items-center gap-1 text-lg text-ink-muted transition hover:text-ink"
      >
        <IconChevronLeft className="size-5" />
        Recipe list
      </Link>

      <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-ink">
        {recipe.title}
      </h1>

      <div className="mt-6">
        <ServingsToggle value={targetServings} onChange={setServings} />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 font-display text-2xl font-medium text-ink">Ingredients</h2>
        <ul className="space-y-2 text-xl">
          {recipe.ingredients.map((ingredient) => (
            <li key={ingredient.id} className="text-ink">
              <span className="font-mono tabular-nums">
                {formatAmount(scaleAmount(ingredient.amount, recipe.servingsBase, targetServings))}
                {ingredient.unit ? ` ${ingredient.unit.toLowerCase()}` : ''}
              </span>{' '}
              {ingredient.name}
            </li>
          ))}
        </ul>
      </div>

      <ButtonLink to={`/cook/${recipe.id}/steps`} variant="primary" size="lg" className="mt-10">
        Start Cooking
      </ButtonLink>
    </div>
  )
}
