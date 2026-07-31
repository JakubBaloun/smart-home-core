import type { RecipeStep } from '../../types/recipe'

export function StepView({ step, index, total }: { step: RecipeStep; index: number; total: number }) {
  return (
    <div className="w-full max-w-3xl">
      <p className="font-mono text-sm tracking-widest text-ink-faint uppercase">
        Step {index + 1} of {total}
      </p>
      {step.title && (
        <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink lg:text-5xl">
          {step.title}
        </h2>
      )}
      <p className="mt-6 whitespace-pre-line text-2xl leading-relaxed text-ink lg:text-3xl">
        {step.content}
      </p>
    </div>
  )
}
