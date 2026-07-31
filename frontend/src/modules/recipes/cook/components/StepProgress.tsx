import type { RecipeStep } from '../../types/recipe'

export function StepProgress({
  steps,
  currentIndex,
  onSelect,
}: {
  steps: RecipeStep[]
  currentIndex: number
  onSelect: (index: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-center">
      {steps.map((step, index) => (
        <button
          key={step.id}
          type="button"
          onClick={() => onSelect(index)}
          aria-label={step.title ? `Step ${index + 1}: ${step.title}` : `Step ${index + 1}`}
          aria-current={index === currentIndex ? 'step' : undefined}
          className="flex size-11 items-center justify-center"
        >
          <span
            className={`h-1.5 rounded-full transition-all ${
              index === currentIndex
                ? 'w-8 bg-accent'
                : index < currentIndex
                  ? 'w-1.5 bg-ink-faint'
                  : 'w-1.5 bg-line-strong'
            }`}
          />
        </button>
      ))}
    </div>
  )
}
