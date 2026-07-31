import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { IngredientPanel } from './IngredientPanel'
import type { RecipeIngredient } from '../../types/recipe'

const ingredients: RecipeIngredient[] = [
  { id: 1, name: 'butter', amount: 200, unit: 'G', sortOrder: 0 },
  { id: 2, name: 'eggs', amount: 3, unit: null, sortOrder: 1 },
]

function renderPanel(overrides: Partial<Parameters<typeof IngredientPanel>[0]> = {}) {
  const props = {
    ingredients,
    servingsBase: 4,
    servings: 4,
    onServingsChange: vi.fn(),
    checkedIds: [] as number[],
    onToggle: vi.fn(),
    ...overrides,
  }
  render(<IngredientPanel {...props} />)
  return props
}

describe('IngredientPanel', () => {
  it('shows amounts with their unit', () => {
    renderPanel()

    expect(screen.getByRole('button', { name: '200 g butter' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3 eggs' })).toBeInTheDocument()
  })

  it('scales amounts to the chosen servings', () => {
    renderPanel({ servings: 6 })

    expect(screen.getByRole('button', { name: '300 g butter' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '4½ eggs' })).toBeInTheDocument()
  })

  it('reports a tapped ingredient', () => {
    const { onToggle } = renderPanel()

    fireEvent.click(screen.getByRole('button', { name: '200 g butter' }))

    expect(onToggle).toHaveBeenCalledWith(1)
  })

  it('marks checked ingredients as pressed', () => {
    renderPanel({ checkedIds: [2] })

    expect(screen.getByRole('button', { name: '200 g butter' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: '3 eggs' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps the recipe notes in reach while cooking', () => {
    renderPanel({ notes: 'Preheat the oven' })

    expect(screen.getByText('Preheat the oven')).toBeInTheDocument()
  })
})
