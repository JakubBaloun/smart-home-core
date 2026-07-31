import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePolling } from '@/hooks/usePolling'
import { Loading } from '@/ui/Loading'
import { IconHome } from '@/ui/icons'
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
    <div className="h-full overflow-y-auto p-6 lg:p-10">
      <Link
        to="/"
        className="-my-2 inline-flex min-h-11 items-center gap-1 py-2 text-lg text-ink-muted transition hover:text-ink"
      >
        <IconHome className="size-5" />
        Dashboard
      </Link>

      <h1 className="mt-4 mb-6 font-display text-4xl font-semibold tracking-tight text-ink lg:text-5xl">
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

      {page && page.items.length === 0 && (
        <p className="text-lg text-ink-muted">Nothing matches that. Try a different search or tag.</p>
      )}

      {page && page.items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {page.items.map((recipe) => (
            <CookRecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </div>
  )
}
