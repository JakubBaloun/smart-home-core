import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'graphite' | 'obsidian-aurora' | 'amber-forge' | 'midnight-chrome'

export const THEMES: ReadonlyArray<{ id: Theme; label: string; mode: 'light' | 'dark' }> = [
  { id: 'light', label: 'Light', mode: 'light' },
  { id: 'graphite', label: 'Graphite', mode: 'dark' },
  { id: 'obsidian-aurora', label: 'Obsidian Aurora', mode: 'dark' },
  { id: 'amber-forge', label: 'Amber Forge', mode: 'dark' },
  { id: 'midnight-chrome', label: 'Midnight Chrome', mode: 'dark' },
]

const KNOWN_THEMES = new Set<Theme>(THEMES.map((t) => t.id))

const STORAGE_KEY = 'nexus-theme'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'graphite', setTheme: () => {} })

function isKnownTheme(value: string | null): value is Theme {
  return value !== null && KNOWN_THEMES.has(value as Theme)
}

function resolveInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)

  if (stored === 'dark') {
    localStorage.setItem(STORAGE_KEY, 'graphite')
    return 'graphite'
  }

  if (isKnownTheme(stored)) {
    return stored
  }

  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'graphite'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // index.html sets data-theme before first paint; the provider mirrors it and
  // migrates any legacy/unknown stored value.
  const [theme, setThemeState] = useState<Theme>(() => {
    const resolved = resolveInitialTheme()
    document.documentElement.dataset.theme = resolved
    return resolved
  })

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.dataset.theme = next
    localStorage.setItem(STORAGE_KEY, next)
    setThemeState(next)
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}

/**
 * Resolved token values for libraries that cannot consume CSS variables
 * directly (Recharts renders SVG presentation attributes).
 */
export function useChartPalette() {
  // Subscribing to the theme re-renders consumers when [data-theme] (and thus
  // the computed token values) changes.
  useTheme()
  const style = getComputedStyle(document.documentElement)
  const token = (name: string) => style.getPropertyValue(name).trim()
  return {
    series: token('--cool'),
    accent: token('--accent'),
    ok: token('--ok'),
    okDark: token('--ok-dark') || 'color-mix(in srgb, var(--ok) 55%, #000)',
    warm: token('--warm'),
    danger: token('--danger'),
    extreme: token('--extreme'),
    axis: token('--ink-faint'),
    tooltipBg: token('--overlay'),
    tooltipBorder: token('--line'),
    tooltipInk: token('--ink'),
  }
}
