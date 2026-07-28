import type { Tag } from '../types/recipe'

export function TagFilter({
  tags,
  selected,
  onToggle,
}: {
  tags: Tag[]
  selected: string[]
  onToggle: (name: string) => void
}) {
  if (tags.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => {
        const isSelected = selected.includes(tag.name)
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => onToggle(tag.name)}
            className={`rounded-full px-3 py-1 text-sm transition ${
              isSelected
                ? 'bg-purple-700 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {tag.name}
          </button>
        )
      })}
    </div>
  )
}
