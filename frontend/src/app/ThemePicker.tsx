import { useEffect, useRef, useState } from 'react'
import { IconPalette } from '@/ui/icons'
import { THEMES, useTheme, type Theme } from './theme'

export function ThemePicker() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    function handleMouseDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function choose(id: Theme) {
    setTheme(id)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative shrink-0 sm:mt-auto">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Choose theme"
        className="flex size-12 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-raised hover:text-ink"
      >
        <IconPalette className="size-6" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Themes"
          className="glass chrome-edge absolute right-0 bottom-full mb-2 w-52 rounded-2xl border border-line p-1.5 shadow-lg sm:right-auto sm:left-0"
        >
          {THEMES.map(({ id, label }) => {
            const active = id === theme

            return (
              <button
                key={id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => choose(id)}
                className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition ${
                  active
                    ? 'glow-accent bg-accent/20 text-accent'
                    : 'text-ink-muted hover:bg-surface-raised hover:text-ink'
                }`}
              >
                <span className={`theme-swatch-${id} size-4`} aria-hidden="true" />
                {label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
