import { ChipButton } from '@/ui/Chip'
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
      {tags.map((tag) => (
        <ChipButton key={tag.id} selected={selected.includes(tag.name)} onClick={() => onToggle(tag.name)}>
          {tag.name}
        </ChipButton>
      ))}
    </div>
  )
}
