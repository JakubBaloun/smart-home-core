import { fieldClasses } from '@/ui/field'

export function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search by title or ingredient..."
      className={`w-full ${fieldClasses}`}
    />
  )
}
