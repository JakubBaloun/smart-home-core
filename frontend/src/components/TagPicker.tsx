import { useState } from 'react'
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
          <span
            key={name}
            className="flex items-center gap-1 rounded-full bg-purple-700 px-3 py-1 text-sm text-white"
          >
            {name}
            <button
              type="button"
              onClick={() => removeTag(name)}
              className="ml-1 text-purple-200 hover:text-white"
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
          className="w-full rounded-lg border border-gray-800 bg-gray-900 px-4 py-2 text-gray-100 placeholder-gray-600 focus:border-purple-600 focus:outline-none"
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
            {suggestions.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => addTag(name)}
                  className="block w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-800"
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
