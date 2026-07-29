import type { ComponentProps } from 'react'

const BASE = 'inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm transition'

export function chipClasses(selected = false): string {
  return selected
    ? `${BASE} bg-accent text-accent-ink`
    : `${BASE} border border-line bg-surface-raised text-ink-muted`
}

/** Non-interactive tag label. */
export function Chip({ className = '', ...props }: ComponentProps<'span'>) {
  return <span className={`${chipClasses()} ${className}`} {...props} />
}

/** Toggleable tag button (filters, pickers). */
export function ChipButton({
  selected = false,
  className = '',
  ...props
}: { selected?: boolean } & ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={`${chipClasses(selected)} ${selected ? '' : 'hover:border-line-strong hover:text-ink'} ${className}`}
      {...props}
    />
  )
}
