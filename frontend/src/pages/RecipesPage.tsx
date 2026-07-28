import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getRecipes } from '../api/recipes'
import { getTags } from '../api/tags'
import { RecipeGrid } from '../components/RecipeGrid'
import { SearchBox } from '../components/SearchBox'
import { TagFilter } from '../components/TagFilter'
import { usePolling } from '../hooks/usePolling'

const REFRESH_INTERVAL_MS = 15_000

export function RecipesPage() {
  const [search, setSearch] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const { data: page, error, loading } = usePolling(
    () => getRecipes({ search: search || undefined, tags: selectedTags }),
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
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-100">Recipes</h1>
        <Link
          to="/recipes/new"
          className="rounded-lg bg-purple-700 px-4 py-2 font-medium text-white transition hover:bg-purple-600"
        >
          New Recipe
        </Link>
      </div>

      <div className="mb-4 max-w-md">
        <SearchBox value={search} onChange={setSearch} />
      </div>

      {tags && tags.length > 0 && (
        <div className="mb-6">
          <TagFilter tags={tags} selected={selectedTags} onToggle={toggleTag} />
        </div>
      )}

      {loading && !page && <p className="text-gray-500">Loading recipes...</p>}
      {error && <p className="text-red-400">Failed to load recipes: {error.message}</p>}
      {page && <RecipeGrid recipes={page.items} />}
    </div>
  )
}
