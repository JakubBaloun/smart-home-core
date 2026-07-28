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
      <button
        type="button"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-800 text-xl font-medium text-gray-100 transition hover:bg-gray-700 disabled:opacity-40"
      >
        −
      </button>
      <span className="min-w-16 text-center text-lg text-gray-100">{value} servings</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-800 text-xl font-medium text-gray-100 transition hover:bg-gray-700"
      >
        +
      </button>
    </div>
  )
}
