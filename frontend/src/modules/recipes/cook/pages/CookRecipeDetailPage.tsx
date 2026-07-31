import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePolling } from '@/hooks/usePolling'
import { Button } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import { Loading } from '@/ui/Loading'
import { IconChevronLeft, IconClock, IconServing } from '@/ui/icons'
import { getRecipe } from '../../api/recipes'
import { formatTotalTime } from '../../lib/units'
import { IngredientPanel, IngredientProgress } from '../components/IngredientPanel'
import { useCookProgress } from '../hooks/useCookProgress'

const REFRESH_INTERVAL_MS = 15_000

export function CookRecipeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const recipeId = Number(id)
  const navigate = useNavigate()
  const progress = useCookProgress(recipeId)

  const { data: recipe, error } = usePolling(() => getRecipe(recipeId), REFRESH_INTERVAL_MS, [recipeId])

  if (error) {
    return <p className="p-8 text-xl text-danger">Failed to load recipe: {error.message}</p>
  }

  if (!recipe) {
    return <Loading />
  }

  const servings = progress.servings ?? recipe.servingsBase
  const totalTime = formatTotalTime(recipe.prepTimeMinutes, recipe.cookTimeMinutes)
  const checkedCount = recipe.ingredients.filter((ingredient) =>
    progress.checkedIngredientIds.includes(ingredient.id),
  ).length
  const resumeStepIndex = Math.min(progress.resumeStepIndex, recipe.steps.length - 1)
  const canResume = resumeStepIndex > 0

  const openStep = (index: number) => {
    progress.setStepIndex(index)
    navigate(`/cook/${recipeId}/steps`)
  }

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-10">
      <Link
        to="/cook"
        className="-my-2 inline-flex min-h-11 items-center gap-1 py-2 text-lg text-ink-muted transition hover:text-ink"
      >
        <IconChevronLeft className="size-5" />
        Recipe list
      </Link>

      <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-ink lg:text-5xl">
        {recipe.title}
      </h1>

      {recipe.description && (
        <p className="mt-3 max-w-2xl text-lg text-ink-muted">{recipe.description}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-ink-muted tabular-nums">
        {totalTime && (
          <span className="inline-flex items-center gap-1.5">
            <IconClock className="size-4 text-ink-faint" />
            {totalTime}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <IconServing className="size-4 text-ink-faint" />
          serves {recipe.servingsBase}
        </span>
        <span>
          {recipe.steps.length} {recipe.steps.length === 1 ? 'step' : 'steps'}
        </span>
      </div>

      {recipe.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {recipe.tags.map((tag) => (
            <Chip key={tag.id}>{tag.name}</Chip>
          ))}
        </div>
      )}

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[24rem_minmax(0,1fr)]">
        <section className="rounded-2xl border border-line bg-surface-raised p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-medium text-ink">Ingredients</h2>
            <IngredientProgress checkedCount={checkedCount} total={recipe.ingredients.length} />
          </div>
          <IngredientPanel
            ingredients={recipe.ingredients}
            servingsBase={recipe.servingsBase}
            servings={servings}
            onServingsChange={progress.setServings}
            checkedIds={progress.checkedIngredientIds}
            onToggle={progress.toggleIngredient}
            notes={recipe.notes}
          />
        </section>

        <section className="rounded-2xl border border-line bg-surface-raised p-5">
          <h2 className="mb-4 font-display text-2xl font-medium text-ink">Steps</h2>
          {recipe.steps.length === 0 ? (
            <p className="text-ink-muted">This recipe has no steps yet.</p>
          ) : (
            <ol>
              {recipe.steps.map((step, index) => (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => openStep(index)}
                    className="flex min-h-14 w-full items-center gap-4 rounded-xl px-2 text-left transition hover:bg-overlay active:scale-[0.99]"
                  >
                    <span className="w-6 shrink-0 text-right font-mono text-accent tabular-nums">
                      {index + 1}
                    </span>
                    <span className="text-ink">{step.title ?? step.content}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="sticky bottom-0 -mx-6 mt-8 flex flex-wrap gap-3 border-t border-line bg-surface px-6 py-4 lg:-mx-10 lg:px-10">
        {canResume ? (
          <>
            <Button variant="primary" size="lg" onClick={() => openStep(resumeStepIndex)}>
              Resume — step {resumeStepIndex + 1}
            </Button>
            <Button
              variant="neutral"
              size="lg"
              onClick={() => {
                progress.reset()
                navigate(`/cook/${recipeId}/steps`)
              }}
            >
              Start over
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            size="lg"
            disabled={recipe.steps.length === 0}
            onClick={() => openStep(0)}
          >
            Start cooking
          </Button>
        )}
      </div>
    </div>
  )
}
