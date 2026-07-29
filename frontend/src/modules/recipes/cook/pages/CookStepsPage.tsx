import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePolling } from '@/hooks/usePolling'
import { Loading } from '@/ui/Loading'
import { getRecipe } from '../../api/recipes'
import { CookNav } from '../components/CookNav'
import { StepTimer } from '../components/StepTimer'
import { StepView } from '../components/StepView'
import { useWakeLock } from '../hooks/useWakeLock'

const REFRESH_INTERVAL_MS = 15_000

export function CookStepsPage() {
  const { id } = useParams<{ id: string }>()
  const recipeId = Number(id)
  const navigate = useNavigate()
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  const { data: recipe, error } = usePolling(() => getRecipe(recipeId), REFRESH_INTERVAL_MS, [recipeId])

  useWakeLock(true)

  if (error) {
    return <p className="p-8 text-xl text-danger">Failed to load recipe: {error.message}</p>
  }

  if (!recipe) {
    return <Loading />
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
