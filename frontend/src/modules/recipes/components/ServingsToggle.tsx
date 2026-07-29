import { Button } from '@/ui/Button'

export function ServingsToggle({
  value,
  onChange,
  min = 1,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
}) {
  return (
    <div className="flex items-center gap-3">
      <Button
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="size-12 !px-0 text-xl"
        aria-label="Fewer servings"
      >
        −
      </Button>
      <span className="min-w-24 text-center text-lg text-ink">
        <span className="font-mono font-medium tabular-nums">{value}</span> servings
      </span>
      <Button
        onClick={() => onChange(value + 1)}
        className="size-12 !px-0 text-xl"
        aria-label="More servings"
      >
        +
      </Button>
    </div>
  )
}
