import { Button } from '@/ui/Button'
import { fieldOnRaisedClasses } from '@/ui/field'
import type { StepInput } from '../types/recipe'

const EMPTY_STEP: StepInput = { title: null, content: '', timerSeconds: null }

const compactField = `${fieldOnRaisedClasses} px-3 py-2`

export function StepListEditor({
  value,
  onChange,
}: {
  value: StepInput[]
  onChange: (value: StepInput[]) => void
}) {
  const update = (index: number, patch: Partial<StepInput>) => {
    onChange(value.map((step, i) => (i === index ? { ...step, ...patch } : step)))
  }

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= value.length) return
    const next = [...value]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {value.map((step, index) => (
        <div key={index} className="rounded-2xl border border-line bg-surface-raised p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-xs tracking-wider text-ink-faint uppercase">
              Step {index + 1}
            </span>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">
                ↑
              </Button>
              <Button
                size="sm"
                onClick={() => move(index, 1)}
                disabled={index === value.length - 1}
                aria-label="Move down"
              >
                ↓
              </Button>
              <Button size="sm" variant="danger" onClick={() => remove(index)} aria-label="Remove step">
                ✕
              </Button>
            </div>
          </div>
          <input
            type="text"
            value={step.title ?? ''}
            onChange={(e) => update(index, { title: e.target.value || null })}
            placeholder="Step title (optional)"
            className={`mb-2 w-full ${compactField}`}
          />
          <textarea
            value={step.content}
            onChange={(e) => update(index, { content: e.target.value })}
            placeholder="What to do..."
            rows={2}
            className={`mb-2 w-full ${compactField}`}
          />
          <input
            type="number"
            min={1}
            value={step.timerSeconds ?? ''}
            onChange={(e) => update(index, { timerSeconds: e.target.value ? Number(e.target.value) : null })}
            placeholder="Timer (seconds, optional)"
            className={`w-48 font-mono ${compactField}`}
          />
        </div>
      ))}
      <Button size="sm" onClick={() => onChange([...value, { ...EMPTY_STEP }])}>
        + Add step
      </Button>
    </div>
  )
}
