import type { RecipeStep } from '../../types/recipe'

export function StepView({ step, index, total }: { step: RecipeStep; index: number; total: number }) {
  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-lg text-gray-500">
        Step {index + 1} of {total}
      </p>
      {step.title && <h2 className="mt-2 text-3xl font-semibold text-gray-100">{step.title}</h2>}
      <p className="mt-6 max-w-2xl text-2xl leading-relaxed text-gray-200">{step.content}</p>
    </div>
  )
}
