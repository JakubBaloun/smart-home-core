import { Link, Outlet, useLocation } from 'react-router-dom'
import { Ring } from '@/ui/Ring'
import { IconMoon, IconSun } from '@/ui/icons'
import { shellModules, type ModuleNav } from './modules'
import { useTheme } from './theme'

function RailLink({ nav }: { nav: ModuleNav }) {
  const { pathname } = useLocation()
  const active = nav.isActive(pathname)

  return (
    <Link
      to={nav.to}
      aria-label={nav.label}
      title={nav.label}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 transition sm:w-full sm:flex-none ${
        active ? 'bg-accent/20 text-accent' : 'text-ink-muted hover:bg-surface-raised hover:text-ink'
      }`}
    >
      <nav.icon className="size-6" />
      <span className="w-full truncate text-center font-display text-[10px] tracking-wide uppercase">
        {nav.railLabel}
      </span>
    </Link>
  )
}

export function AppShell() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="flex h-full flex-col sm:flex-row">
      {/* Phone: horizontal tab bar pinned to the bottom (order-2). Tablet/desktop (sm+):
          vertical rail on the left, restored to its original order and column layout. */}
      <nav className="order-2 flex w-full shrink-0 items-center gap-1 border-t border-line bg-surface-sunken px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:order-1 sm:w-20 sm:flex-col sm:border-t-0 sm:border-r sm:px-2 sm:py-4">
        <Link to="/" aria-label="Nexus" title="Nexus" className="hidden text-accent sm:mb-6 sm:block">
          <Ring size={30} strokeWidth={5.5} />
        </Link>

        <div className="flex w-full items-center gap-1 sm:flex-col sm:gap-3">
          {shellModules.map((module) => (
            <RailLink key={module.nav.to} nav={module.nav} />
          ))}
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className="flex size-12 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-raised hover:text-ink sm:mt-auto"
        >
          {theme === 'dark' ? <IconSun className="size-6" /> : <IconMoon className="size-6" />}
        </button>
      </nav>

      <main className="order-1 min-w-0 flex-1 overflow-hidden sm:order-2">
        <Outlet />
      </main>
    </div>
  )
}
