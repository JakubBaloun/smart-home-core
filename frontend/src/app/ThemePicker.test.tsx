import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { ThemePicker } from './ThemePicker'
import { ThemeProvider } from './theme'

function renderPicker() {
  return render(
    <ThemeProvider>
      <ThemePicker />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('nexus-theme', 'graphite')
})

describe('ThemePicker', () => {
  it('renders a trigger button with an accessible name', () => {
    renderPicker()

    expect(screen.getByRole('button', { name: 'Choose theme' })).toBeInTheDocument()
  })

  it('lists all five theme labels when opened', () => {
    renderPicker()

    fireEvent.click(screen.getByRole('button', { name: 'Choose theme' }))

    expect(screen.getByRole('menuitemradio', { name: 'Light' })).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: 'Graphite' })).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: 'Obsidian Aurora' })).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: 'Amber Forge' })).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: 'Midnight Chrome' })).toBeInTheDocument()
  })

  it('marks the current theme as checked and others as unchecked', () => {
    renderPicker()

    fireEvent.click(screen.getByRole('button', { name: 'Choose theme' }))

    expect(screen.getByRole('menuitemradio', { name: 'Graphite' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('menuitemradio', { name: 'Light' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    expect(screen.getByRole('menuitemradio', { name: 'Obsidian Aurora' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('applies a clicked theme and closes the menu', () => {
    renderPicker()

    fireEvent.click(screen.getByRole('button', { name: 'Choose theme' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Amber Forge' }))

    expect(document.documentElement.dataset.theme).toBe('amber-forge')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes the menu on Escape', () => {
    renderPicker()

    fireEvent.click(screen.getByRole('button', { name: 'Choose theme' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose theme' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('closes the menu on outside click', () => {
    renderPicker()

    fireEvent.click(screen.getByRole('button', { name: 'Choose theme' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
