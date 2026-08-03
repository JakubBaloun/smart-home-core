import { ChipButton } from '@/ui/Chip'
import type { Person } from '../types/calendarEvent'

const OPTIONS: { value: Person | null; label: string }[] = [
  { value: null, label: 'Nobody specific' },
  { value: 'KUBA', label: 'Kuba' },
  { value: 'PETA', label: 'Péťa' },
  { value: 'BOTH', label: 'Both' },
]

export function PersonSelect({
  value,
  onChange,
}: {
  value: Person | null
  onChange: (person: Person | null) => void
}) {
  return (
    <div role="radiogroup" aria-label="Person" className="flex gap-2">
      {OPTIONS.map((option) => (
        <ChipButton
          key={option.value ?? 'NONE'}
          role="radio"
          aria-checked={value === option.value}
          selected={value === option.value}
          onClick={() => onChange(option.value)}
          className="min-h-12 px-4"
        >
          {option.label}
        </ChipButton>
      ))}
    </div>
  )
}
