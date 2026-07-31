import { useState } from 'react'

export interface LiveDotProps {
  online: boolean
  size?: number
  className?: string
}

const BREATHE_DURATION_MS = 2500

/**
 * A solid status dot — online/offline, never a spinner. Callers wrap it in
 * `<span title="Online"|"Offline">` the same way they wrapped `Ring` before.
 */
export function LiveDot({ online, size = 10, className }: LiveDotProps) {
  // Negative delay starts each dot mid-cycle at a random phase, so a grid of
  // online dots doesn't all pulse in lockstep.
  const [phaseOffsetMs] = useState(() => -Math.random() * BREATHE_DURATION_MS)

  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, animationDelay: online ? `${phaseOffsetMs}ms` : undefined }}
      className={`inline-block shrink-0 rounded-full ${online ? 'bg-ok animate-breathe' : 'bg-ink-faint'} ${className ?? ''}`}
    />
  )
}
