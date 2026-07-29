import { useState } from 'react'
import { chipClasses } from '@/ui/Chip'
import { fieldClasses } from '@/ui/field'
import type { Tag } from '../types/recipe'

export function TagPicker({
  allTags,
  selected,
  onChange,
}: {
  allTags: Tag[]
  selected: string[]
  onChange: (names: string[]) => void
}) {
  const [input, setInput] = useState('')

  const suggestions = allTags
    .map((tag) => tag.name)
    .filter((name) => !selected.includes(name))
    .filter((name) => input.trim() !== '' && name.toLowerCase().includes(input.trim().toLowerCase()))
    .slice(0, 5)

  const addTag = (name: string) => {
    const trimmed = name.trim()
    if (trimmed === '' || selected.includes(trimmed)) return
    onChange([...selected, trimmed])
    setInput('')
  }

  const removeTag = (name: string) => {
    onChange(selected.filter((n) => n !== name))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag(input)
    }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {selected.map((name) => (
          <span key={name} className={chipClasses(true)}>
            {name}
            <button
              type="button"
              onClick={() => removeTag(name)}
              className="ml-1 opacity-70 transition hover:opacity-100"
              aria-label={`Remove tag ${name}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add tag and press Enter..."
          className={`w-full ${fieldClasses} py-2`}
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-line bg-overlay shadow-lg">
            {suggestions.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => addTag(name)}
                  className="block w-full px-4 py-2 text-left text-ink transition hover:bg-surface-raised"
                >
                  {name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
