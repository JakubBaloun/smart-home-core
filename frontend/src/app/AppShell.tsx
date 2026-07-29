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
      className={`relative flex size-12 items-center justify-center rounded-full transition ${
        active ? 'text-accent' : 'text-ink-muted hover:bg-surface-raised hover:text-ink'
      }`}
    >
      {active && <Ring size={48} strokeWidth={2.5} className="absolute inset-0" />}
      <nav.icon className="size-6" />
    </Link>
  )
}

export function AppShell() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="flex h-full">
      <nav className="flex w-16 shrink-0 flex-col items-center border-r border-line bg-surface-sunken py-4">
        <Link to="/" aria-label="Nexus" title="Nexus" className="mb-6 text-accent">
          <Ring size={30} strokeWidth={5.5} />
        </Link>

        <div className="flex flex-col items-center gap-3">
          {shellModules.map((module) => (
            <RailLink key={module.nav.to} nav={module.nav} />
          ))}
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className="mt-auto flex size-12 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-raised hover:text-ink"
        >
          {theme === 'dark' ? <IconSun className="size-6" /> : <IconMoon className="size-6" />}
        </button>
      </nav>

      <main className="min-w-0 flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
