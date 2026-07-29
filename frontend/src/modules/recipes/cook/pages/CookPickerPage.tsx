import { useState } from 'react'
import { usePolling } from '@/hooks/usePolling'
import { Loading } from '@/ui/Loading'
import { getRecipes } from '../../api/recipes'
import { getTags } from '../../api/tags'
import { SearchBox } from '../../components/SearchBox'
import { TagFilter } from '../../components/TagFilter'
import { CookRecipeCard } from '../components/CookRecipeCard'

const REFRESH_INTERVAL_MS = 15_000

export function CookPickerPage() {
  const [search, setSearch] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const { data: page, loading } = usePolling(
    () => getRecipes({ search: search || undefined, tags: selectedTags, size: 100 }),
    REFRESH_INTERVAL_MS,
    [search, selectedTags],
  )

  const { data: tags } = usePolling(getTags, REFRESH_INTERVAL_MS)

  const toggleTag = (name: string) => {
    setSelectedTags((current) =>
      current.includes(name) ? current.filter((n) => n !== name) : [...current, name],
    )
  }

  return (
    <div className="h-full overflow-y-auto p-8">
      <h1 className="mb-6 font-display text-4xl font-semibold tracking-tight text-ink">
        What are we cooking?
      </h1>

      <div className="mb-4 max-w-lg">
        <SearchBox value={search} onChange={setSearch} />
      </div>

      {tags && tags.length > 0 && (
        <div className="mb-6">
          <TagFilter tags={tags} selected={selectedTags} onToggle={toggleTag} />
        </div>
      )}

      {loading && !page && <Loading label="Fetching recipes…" />}

      {page && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {page.items.map((recipe) => (
            <CookRecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </div>
  )
}
