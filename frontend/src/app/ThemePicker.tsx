import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconPalette } from '@/ui/icons'
import { THEMES, useTheme, type Theme } from './theme'

const MENU_WIDTH = 224 // w-56
const MENU_GAP = 8

interface MenuPosition {
  top: number
  left: number
}

export function ThemePicker() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<MenuPosition | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    const trigger = triggerRef.current
    if (trigger) {
      const rect = trigger.getBoundingClientRect()
      const left = Math.min(rect.left, window.innerWidth - MENU_WIDTH - MENU_GAP)
      setPosition({ top: rect.top - MENU_GAP, left: Math.max(MENU_GAP, left) })
    }

    function handleMouseDown(event: MouseEvent) {
      const target = event.target as Node
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    function handleReposition() {
      setOpen(false)
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
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

      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Themes"
            style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
            className="glass chrome-edge fixed z-50 -translate-y-full rounded-2xl border border-line p-1.5 shadow-lg"
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
                  <span className={`theme-swatch-${id} size-4 shrink-0`} aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}
