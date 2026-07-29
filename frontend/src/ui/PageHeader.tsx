import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IconChevronLeft } from './icons'

function Clock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <time className="font-mono text-sm text-ink-faint tabular-nums">
      {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </time>
  )
}

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: string
  subtitle?: ReactNode
  back?: { to: string; label: string }
  actions?: ReactNode
}) {
  return (
    <header className="mb-6">
      {back && (
        <Link
          to={back.to}
          className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted transition hover:text-ink"
        >
          <IconChevronLeft className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-3xl font-semibold tracking-tight text-ink">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {actions}
          <Clock />
        </div>
      </div>
    </header>
  )
}
