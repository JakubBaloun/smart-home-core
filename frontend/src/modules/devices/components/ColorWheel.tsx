import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'

const SIZE = 200
const RADIUS = SIZE / 2

interface ColorWheelProps {
  hue: number
  saturation: number
  disabled?: boolean
  onChange?: (hue: number, saturation: number) => void
  onCommit: (hue: number, saturation: number) => void
}

/**
 * Pure pointer-math: pointer offset from the wheel centre (`dx`, `dy` in
 * pixels, +y downwards) mapped to hue (0-360, 0 = +x axis, growing clockwise
 * because +y is downwards) and saturation (0-100, radial distance from centre
 * clamped to the wheel edge).
 */
export function positionToHueSaturation(
  dx: number,
  dy: number,
  radius: number,
): { hue: number; saturation: number } {
  const distance = Math.sqrt(dx * dx + dy * dy)
  const saturationRaw = distance === 0 ? 0 : Math.min(1, distance / radius) * 100
  const saturation = Math.round(saturationRaw)
  if (distance === 0) {
    return { hue: 0, saturation }
  }
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI
  if (angle < 0) angle += 360
  return { hue: Math.round(angle) % 360, saturation }
}

function polarToCartesian(hue: number, saturation: number, radius: number) {
  const distance = (saturation / 100) * radius
  const rad = (hue * Math.PI) / 180
  return {
    x: radius + Math.cos(rad) * distance,
    y: radius + Math.sin(rad) * distance,
  }
}

export function ColorWheel({
  hue,
  saturation,
  disabled,
  onChange,
  onCommit,
}: ColorWheelProps) {
  const [localHue, setLocalHue] = useState(hue)
  const [localSaturation, setLocalSaturation] = useState(saturation)
  const draggingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!draggingRef.current) setLocalHue(hue)
  }, [hue])
  useEffect(() => {
    if (!draggingRef.current) setLocalSaturation(saturation)
  }, [saturation])

  const compute = (e: PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return null
    const dx = e.clientX - rect.left - RADIUS
    const dy = e.clientY - rect.top - RADIUS
    return positionToHueSaturation(dx, dy, RADIUS)
  }

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
    draggingRef.current = true
    const next = compute(e)
    if (next) {
      setLocalHue(next.hue)
      setLocalSaturation(next.saturation)
      onChange?.(next.hue, next.saturation)
    }
  }

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    const next = compute(e)
    if (next) {
      setLocalHue(next.hue)
      setLocalSaturation(next.saturation)
      onChange?.(next.hue, next.saturation)
    }
  }

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    const next = compute(e) ?? { hue: localHue, saturation: localSaturation }
    setLocalHue(next.hue)
    setLocalSaturation(next.saturation)
    onCommit(next.hue, next.saturation)
  }

  const thumb = polarToCartesian(localHue, localSaturation, RADIUS)
  const wheelStyle: CSSProperties = {
    width: SIZE,
    height: SIZE,
    background: `
      radial-gradient(circle at center, hsl(0 0% 100%) 0%, hsla(0, 0%, 100%, 0) 70%),
      conic-gradient(from 0deg,
        hsl(0 100% 50%),   hsl(60 100% 50%),  hsl(120 100% 50%),
        hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%),
        hsl(360 100% 50%))
    `,
    borderRadius: '50%',
    position: 'relative',
    touchAction: 'none',
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'crosshair',
  }
  const thumbStyle: CSSProperties = {
    position: 'absolute',
    left: thumb.x - 10,
    top: thumb.y - 10,
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: `hsl(${localHue} ${localSaturation}% 50%)`,
    border: '3px solid var(--surface, #fff)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
    pointerEvents: 'none',
  }

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label="Barva"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={localHue}
      aria-disabled={disabled ? 'true' : undefined}
      style={wheelStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div style={thumbStyle} />
    </div>
  )
}
