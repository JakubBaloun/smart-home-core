import type { RecipeStep } from '../../types/recipe'

export function StepView({ step, index, total }: { step: RecipeStep; index: number; total: number }) {
  return (
    <div className="flex flex-col items-center text-center">
      <p className="font-mono text-sm tracking-widest text-ink-faint uppercase">
        Step {index + 1} of {total}
      </p>
      {step.title && (
        <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-ink">
          {step.title}
        </h2>
      )}
      <p className="mt-6 max-w-2xl text-2xl leading-relaxed text-ink">{step.content}</p>
    </div>
  )
}
