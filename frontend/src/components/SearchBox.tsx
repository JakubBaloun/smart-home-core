export function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search by title or ingredient..."
      className="w-full rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 text-gray-100 placeholder-gray-600 focus:border-purple-600 focus:outline-none"
    />
  )
}
