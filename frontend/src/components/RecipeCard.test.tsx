import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { RecipeCard } from './RecipeCard'
import type { Recipe } from '../types/recipe'

const baseRecipe: Recipe = {
  id: 1,
  title: 'Tomato Soup',
  servingsBase: 4,
  prepTimeMinutes: 10,
  cookTimeMinutes: 20,
  tags: [{ id: 1, name: 'soup' }],
}

function renderCard(recipe: Recipe) {
  return render(
    <MemoryRouter>
      <RecipeCard recipe={recipe} />
    </MemoryRouter>,
  )
}

describe('RecipeCard', () => {
  it('shows the title and prep/cook time', () => {
    renderCard(baseRecipe)

    expect(screen.getByText('Tomato Soup')).toBeInTheDocument()
    expect(screen.getByText('Prep 10m · Cook 20m')).toBeInTheDocument()
  })

  it('links to the recipe detail page', () => {
    renderCard(baseRecipe)

    expect(screen.getByRole('link')).toHaveAttribute('href', '/recipes/1')
  })

  it('renders tag chips', () => {
    renderCard(baseRecipe)

    expect(screen.getByText('soup')).toBeInTheDocument()
  })
})
