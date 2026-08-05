import { act, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider, useChartPalette, useTheme, type Theme } from './theme'

function mockMatchMedia(prefersLight: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: light)' ? prefersLight : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
}

function Probe() {
  const { theme } = useTheme()
  return <span data-testid="theme-value">{theme}</span>
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('data-theme')
})

describe('ThemeProvider', () => {
  it('reads a known stored theme', () => {
    localStorage.setItem('nexus-theme', 'graphite')
    mockMatchMedia(false)

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('theme-value')).toHaveTextContent('graphite')
    expect(document.documentElement.dataset.theme).toBe('graphite')
  })

  it('migrates the legacy "dark" value to "graphite" and rewrites localStorage', () => {
    localStorage.setItem('nexus-theme', 'dark')
    mockMatchMedia(false)

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('theme-value')).toHaveTextContent('graphite')
    expect(localStorage.getItem('nexus-theme')).toBe('graphite')
  })

  it('falls back to light when stored value is unknown and prefers-color-scheme is light', () => {
    localStorage.setItem('nexus-theme', 'nonsense')
    mockMatchMedia(true)

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('theme-value')).toHaveTextContent('light')
  })

  it('falls back to graphite when stored value is unknown and prefers-color-scheme is dark/absent', () => {
    localStorage.setItem('nexus-theme', 'nonsense')
    mockMatchMedia(false)

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('theme-value')).toHaveTextContent('graphite')
  })

  it('setTheme updates state, dataset.theme, and localStorage', () => {
    mockMatchMedia(false)

    function Setter() {
      const { setTheme } = useTheme()
      return (
        <button type="button" onClick={() => setTheme('midnight-chrome' as Theme)}>
          switch
        </button>
      )
    }

    render(
      <ThemeProvider>
        <Probe />
        <Setter />
      </ThemeProvider>,
    )

    act(() => {
      screen.getByText('switch').click()
    })

    expect(screen.getByTestId('theme-value')).toHaveTextContent('midnight-chrome')
    expect(document.documentElement.dataset.theme).toBe('midnight-chrome')
    expect(localStorage.getItem('nexus-theme')).toBe('midnight-chrome')
  })
})

describe('useChartPalette', () => {
  beforeEach(() => {
    mockMatchMedia(false)
  })

  it('returns a new value after setTheme changes the active theme', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    )

    const { result } = renderHook(
      () => {
        const palette = useChartPalette()
        const { setTheme } = useTheme()
        return { palette, setTheme }
      },
      { wrapper },
    )

    const before = result.current.palette

    act(() => {
      result.current.setTheme('obsidian-aurora' as Theme)
    })

    const after = result.current.palette

    expect(after).not.toBe(before)
  })
})
