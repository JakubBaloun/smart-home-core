const RADIUS = 20
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/* The mark is a 78% arc with the gap centred at the top. */
const MARK_FRACTION = 0.78
const MARK_ROTATION = -90 + ((1 - MARK_FRACTION) * 360) / 2

export interface RingProps {
  size?: number
  strokeWidth?: number
  /** 0..1 switches the ring into progress mode (full track + progress arc from the top). */
  progress?: number
  spinning?: boolean
  className?: string
}

/**
 * The Nexus ring — the app's signature mark. Used as logo, loading spinner,
 * active-navigation indicator, availability indicator, and timer progress.
 * Colored via `currentColor`.
 */
export function Ring({ size = 24, strokeWidth = 4, progress, spinning = false, className }: RingProps) {
  const isProgress = progress !== undefined
  const fraction = isProgress ? Math.min(Math.max(progress, 0), 1) : MARK_FRACTION
  const rotation = isProgress ? -90 : MARK_ROTATION

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      className={`${spinning ? 'animate-spin' : ''} ${className ?? ''}`}
      aria-hidden="true"
    >
      {isProgress && (
        <circle cx="24" cy="24" r={RADIUS} stroke="var(--line)" strokeWidth={strokeWidth} />
      )}
      <circle
        cx="24"
        cy="24"
        r={RADIUS}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${CIRCUMFERENCE * fraction} ${CIRCUMFERENCE}`}
        transform={`rotate(${rotation} 24 24)`}
      />
    </svg>
  )
}
