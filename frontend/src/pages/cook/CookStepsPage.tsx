import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getRecipe } from '../../api/recipes'
import { CookNav } from '../../components/cook/CookNav'
import { StepTimer } from '../../components/cook/StepTimer'
import { StepView } from '../../components/cook/StepView'
import { useWakeLock } from '../../hooks/useWakeLock'
import { usePolling } from '../../hooks/usePolling'

const REFRESH_INTERVAL_MS = 15_000

export function CookStepsPage() {
  const { id } = useParams<{ id: string }>()
  const recipeId = Number(id)
  const navigate = useNavigate()
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  const { data: recipe, error } = usePolling(() => getRecipe(recipeId), REFRESH_INTERVAL_MS, [recipeId])

  useWakeLock(true)

  if (error) {
    return <p className="p-8 text-xl text-red-400">Failed to load recipe: {error.message}</p>
  }

  if (!recipe) {
    return <p className="p-8 text-xl text-gray-500">Loading...</p>
  }

  const step = recipe.steps[currentStepIndex]
  const isLastStep = currentStepIndex === recipe.steps.length - 1

  return (
    <div className="flex h-full flex-col justify-between p-8">
      <div className="flex flex-1 flex-col items-center justify-center gap-10">
        <StepView step={step} index={currentStepIndex} total={recipe.steps.length} />
        {step.timerSeconds != null && <StepTimer key={step.id} seconds={step.timerSeconds} />}
      </div>

      <CookNav
        canGoBack={currentStepIndex > 0}
        canGoForward
        isLastStep={isLastStep}
        onBack={() => setCurrentStepIndex((i) => Math.max(0, i - 1))}
        onForward={() => {
          if (isLastStep) {
            navigate('/cook')
          } else {
            setCurrentStepIndex((i) => Math.min(recipe.steps.length - 1, i + 1))
          }
        }}
      />
    </div>
  )
}
