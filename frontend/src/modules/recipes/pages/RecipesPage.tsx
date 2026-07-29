import { useState } from 'react'
import { usePolling } from '@/hooks/usePolling'
import { ButtonLink } from '@/ui/Button'
import { Loading } from '@/ui/Loading'
import { PageHeader } from '@/ui/PageHeader'
import { getRecipes } from '../api/recipes'
import { getTags } from '../api/tags'
import { RecipeGrid } from '../components/RecipeGrid'
import { SearchBox } from '../components/SearchBox'
import { TagFilter } from '../components/TagFilter'

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
    <div className="h-full overflow-y-auto px-6 py-5 lg:px-8">
      <PageHeader
        title="Recipes"
        actions={
          <>
            <ButtonLink to="/cook" variant="neutral">
              Cook mode
            </ButtonLink>
            <ButtonLink to="/recipes/new" variant="primary">
              New Recipe
            </ButtonLink>
          </>
        }
      />

      <div className="mb-4 max-w-md">
        <SearchBox value={search} onChange={setSearch} />
      </div>

      {tags && tags.length > 0 && (
        <div className="mb-6">
          <TagFilter tags={tags} selected={selectedTags} onToggle={toggleTag} />
        </div>
      )}

      {loading && !page && <Loading label="Fetching recipes…" />}
      {error && <p className="text-danger">Failed to load recipes: {error.message}</p>}
      {page && <RecipeGrid recipes={page.items} />}
    </div>
  )
}
