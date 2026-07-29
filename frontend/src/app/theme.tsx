import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'nexus-theme'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', toggleTheme: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  // index.html sets data-theme before first paint; the provider just mirrors it.
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
  )

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      document.documentElement.dataset.theme = next
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme])

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
    axis: token('--ink-faint'),
    tooltipBg: token('--overlay'),
    tooltipBorder: token('--line'),
    tooltipInk: token('--ink'),
  }
}
