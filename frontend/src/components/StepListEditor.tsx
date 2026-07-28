import type { StepInput } from '../types/recipe'

const EMPTY_STEP: StepInput = { title: null, content: '', timerSeconds: null }

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
        <div key={index} className="rounded-lg border border-gray-800 bg-gray-900 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-gray-500">Step {index + 1}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                className="rounded-lg bg-gray-800 px-2 py-1 text-gray-400 hover:bg-gray-700 disabled:opacity-30"
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === value.length - 1}
                className="rounded-lg bg-gray-800 px-2 py-1 text-gray-400 hover:bg-gray-700 disabled:opacity-30"
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => remove(index)}
                className="rounded-lg bg-gray-800 px-2 py-1 text-red-400 hover:bg-gray-700"
                aria-label="Remove step"
              >
                ✕
              </button>
            </div>
          </div>
          <input
            type="text"
            value={step.title ?? ''}
            onChange={(e) => update(index, { title: e.target.value || null })}
            placeholder="Step title (optional)"
            className="mb-2 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-gray-100 placeholder-gray-600 focus:border-purple-600 focus:outline-none"
          />
          <textarea
            value={step.content}
            onChange={(e) => update(index, { content: e.target.value })}
            placeholder="What to do..."
            rows={2}
            className="mb-2 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-gray-100 placeholder-gray-600 focus:border-purple-600 focus:outline-none"
          />
          <input
            type="number"
            min={1}
            value={step.timerSeconds ?? ''}
            onChange={(e) => update(index, { timerSeconds: e.target.value ? Number(e.target.value) : null })}
            placeholder="Timer (seconds, optional)"
            className="w-48 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-gray-100 placeholder-gray-600 focus:border-purple-600 focus:outline-none"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, { ...EMPTY_STEP }])}
        className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
      >
        + Add step
      </button>
    </div>
  )
}
