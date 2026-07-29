import { Ring } from './Ring'

export function Loading({ label = 'Waking Nexus…' }: { label?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <Ring size={44} strokeWidth={4} spinning className="text-accent" />
      <p className="font-display text-sm tracking-wide text-ink-faint">{label}</p>
    </div>
  )
}
