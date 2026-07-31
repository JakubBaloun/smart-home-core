import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePolling } from '@/hooks/usePolling'
import { ButtonLink } from '@/ui/Button'
import { Loading } from '@/ui/Loading'
import { IconChevronUp } from '@/ui/icons'
import { getRecipe } from '../../api/recipes'
import { CookNav } from '../components/CookNav'
import { IngredientPanel, IngredientProgress } from '../components/IngredientPanel'
import { StepProgress } from '../components/StepProgress'
import { StepView } from '../components/StepView'
import { useCookProgress } from '../hooks/useCookProgress'
import { useWakeLock } from '../hooks/useWakeLock'

const REFRESH_INTERVAL_MS = 15_000

export function CookStepsPage() {
  const { id } = useParams<{ id: string }>()
  const recipeId = Number(id)
  const navigate = useNavigate()
  const [panelOpen, setPanelOpen] = useState(false)
  const progress = useCookProgress(recipeId)

  const { data: recipe, error } = usePolling(() => getRecipe(recipeId), REFRESH_INTERVAL_MS, [recipeId])

  useWakeLock(true)

  // The recipe can lose steps while it is being cooked from.
  const lastStepIndex = (recipe?.steps.length ?? 0) - 1
  const { stepIndex: storedStepIndex, setStepIndex } = progress
  useEffect(() => {
    if (lastStepIndex >= 0 && storedStepIndex > lastStepIndex) {
      setStepIndex(lastStepIndex)
    }
  }, [lastStepIndex, storedStepIndex, setStepIndex])

  if (error) {
    return <p className="p-8 text-xl text-danger">Failed to load recipe: {error.message}</p>
  }

  if (!recipe) {
    return <Loading />
  }

  if (recipe.steps.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
        <p className="text-2xl text-ink-muted">This recipe has no steps yet.</p>
        <ButtonLink to={`/cook/${recipeId}`} variant="primary" size="lg">
          Back to recipe
        </ButtonLink>
      </div>
    )
  }

  const stepIndex = Math.min(progress.stepIndex, recipe.steps.length - 1)
  const step = recipe.steps[stepIndex]
  const isLastStep = stepIndex === recipe.steps.length - 1
  const servings = progress.servings ?? recipe.servingsBase
  const checkedCount = recipe.ingredients.filter((ingredient) =>
    progress.checkedIngredientIds.includes(ingredient.id),
  ).length

  const finish = () => {
    progress.reset()
    navigate('/cook')
  }

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <aside className="fixed inset-x-0 bottom-0 z-10 max-h-[75vh] overflow-y-auto border-t border-line bg-surface-sunken lg:static lg:h-full lg:max-h-none lg:w-80 lg:shrink-0 lg:border-t-0 lg:border-r xl:w-96">
        <button
          type="button"
          onClick={() => setPanelOpen((open) => !open)}
          aria-expanded={panelOpen}
          className="flex min-h-16 w-full items-center justify-between gap-3 px-5 lg:cursor-default"
        >
          <span className="font-display text-lg font-medium text-ink">Ingredients</span>
          <span className="flex items-center gap-3">
            <IngredientProgress checkedCount={checkedCount} total={recipe.ingredients.length} />
            <IconChevronUp
              className={`size-5 text-ink-faint transition lg:hidden ${panelOpen ? 'rotate-180' : ''}`}
            />
          </span>
        </button>

        <div className={`px-5 pb-6 ${panelOpen ? '' : 'hidden'} lg:block`}>
          <IngredientPanel
            ingredients={recipe.ingredients}
            servingsBase={recipe.servingsBase}
            servings={servings}
            onServingsChange={progress.setServings}
            checkedIds={progress.checkedIngredientIds}
            onToggle={progress.toggleIngredient}
            notes={recipe.notes}
          />
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-y-auto p-6 pb-28 lg:p-10">
        <div className="flex flex-1 items-center justify-center">
          <StepView step={step} index={stepIndex} total={recipe.steps.length} />
        </div>

        <div className="mt-8 space-y-4">
          <StepProgress
            steps={recipe.steps}
            currentIndex={stepIndex}
            onSelect={progress.setStepIndex}
          />
          <CookNav
            canGoBack={stepIndex > 0}
            isLastStep={isLastStep}
            onBack={() => progress.setStepIndex(stepIndex - 1)}
            onForward={() => (isLastStep ? finish() : progress.setStepIndex(stepIndex + 1))}
          />
        </div>
      </main>
    </div>
  )
}
