# Light stat card: bulb-color glow + brightness/color modal

## Problem

`LightStatCard` (`frontend/src/modules/home/components/RoomStatCards.tsx`) shows a state bar
that is always `bg-accent`/`bg-line` regardless of the light's actual color, and offers no way
to adjust brightness or color from the room grid — only an on/off toggle. Full brightness/color
controls (`LightControls` + `ColorWheel`) already exist but only on `DeviceDetailPage`.

## Goals

1. The state bar on a light's stat card glows the color the bulb is actually showing.
2. Brightness and color can be adjusted directly from the room grid, without navigating away.

## Non-goals

- No new brightness/color logic — reuse `LightControls` as-is.
- No layout change to the card grid itself (no per-card expansion, no extra grid reflow).

## Design

### 1. Bulb color derivation

New `modules/devices/lib/bulbColor.ts`, pure function:

```ts
export function bulbColor(device: Device): string | null
```

- `device.state !== 'ON'` → `null`
- `device.colorMode === 'hs'` and `hue`/`saturation` both present → `hsl(${hue} ${saturation}% 55%)`
- else `device.colorTemp` present → interpolate the existing 3-stop cool→warm gradient
  (`#a6c8ff` at 0%, `#ffe9c7` at 55%, `#ff9d4d` at 100%, i.e. the same stops as
  `.light-slider-color-temp` in `index.css`) across `COLOR_TEMP_MIN..COLOR_TEMP_MAX` (153–500,
  matching `LightControls`)
- else → `null`

`null` means "no color info" — callers fall back to the current `var(--accent)` / `bg-line`
behavior, not a hardcoded color.

### 2. State bar

In `LightStatCard`, when `isOn` and `bulbColor(device)` returns a color, the bar's `className`
drops `bg-accent` in favor of an inline `style`:

```ts
style={{ background: color, boxShadow: `0 0 8px -1px ${color}` }}
```

When off, or when no color info is available, behavior is unchanged (`bg-accent` / `bg-line`
classes).

### 3. Controls entry point

A new icon button (`IconPalette`, already used by `ThemePicker`) appears in `StatCardShell`'s
`headerAction` slot next to `LightToggle`, **only** when `device.type === 'LIGHT'` (matches the
existing `LightControls` gating on `DeviceDetailPage`). Click opens a modal. It is a sibling of
the existing `Link` (name/icon) and `LightToggle` — no shared click target, no
`stopPropagation` needed.

### 4. `Modal` component

New `frontend/src/ui/Modal.tsx`, generic and reusable (not light-specific):

- Props: `open: boolean`, `onClose: () => void`, `title?: string`, `children: ReactNode`
- Renders via `createPortal` into `document.body`
- Backdrop: `fixed inset-0`, semi-opaque using `color-mix(in srgb, var(--ink) 40%, transparent)`
  (token-based, no hex) — click closes
- Panel: `role="dialog" aria-modal="true" aria-label={title}`, `bg-surface-raised`,
  `border-line`, reuses `animate-fade-slide-in`
- `Escape` key closes (listener attached only while `open`)
- Returns `null` when `!open` (no DOM node mounted)

### 5. Wiring

`LightStatCard` gains local `const [controlsOpen, setControlsOpen] = useState(false)`. The
palette button sets it `true`; the `Modal`'s `onClose` and a close button set it `false`. Modal
body is `<LightControls device={device} />` unchanged — brightness/color commands, optimistic
state, and gesture handling all already live there and need no duplication.

## Testing

- `bulbColor.test.ts`: hs-mode color, colorTemp interpolation at a few points (min/mid/max),
  off → `null`, no color data → `null`
- `Modal.test.tsx`: renders children when `open`, calls `onClose` on Escape and backdrop click,
  renders nothing when `!open`
- `RoomStatCards.test.tsx`: palette button present only for `LIGHT` devices, click opens modal
  containing a brightness slider, bar picks up inline color style when device reports a color
