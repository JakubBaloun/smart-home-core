# Dashboard UI Life Redesign — Design

## Purpose

The dashboard currently reads as static and interchangeable with a school project: every card
looks alike, the shared `Ring` mark (`frontend/src/ui/Ring.tsx`) is overloaded into four unrelated
meanings (brand logo, active-nav indicator, loading spinner, online/offline badge), and there is no
motion vocabulary beyond a spin animation and instant hover color swaps. The Devices page in
particular is an undifferentiated grid with no structure, even though the underlying data (device
type, live telemetry) supports much more.

This redesign gives the nav rail and the device dashboard ("Overview") a clearer visual language —
a dedicated status primitive instead of an overloaded ring, a small named motion system applied
consistently, and a restructured Overview page that groups devices meaningfully and surfaces live
sensor data instead of just a name and a spinner-look badge.

## Scope

In scope:
- `frontend/src/ui/Ring.tsx` — narrow its role to brand mark + progress only.
- New primitive `frontend/src/ui/LiveDot.tsx` — replaces `Ring` wherever it was used as an
  online/offline badge.
- `frontend/src/app/AppShell.tsx` — nav rail: active-item treatment, icon labels.
- `frontend/src/modules/devices/pages/DashboardPage.tsx`,
  `frontend/src/modules/devices/components/DeviceCard.tsx`,
  `frontend/src/modules/devices/components/DeviceGrid.tsx` — restructured as the "Overview" page.
- `frontend/src/modules/temperature/components/TemperatureCard.tsx` — status badge swap + motion,
  no structural change.
- `frontend/src/index.css` — new named keyframes/utilities for the motion system.

Out of scope:
- **Room Map** (`frontend/src/modules/roomMap/`). Its own design
  (`docs/superpowers/specs/2026-07-31-room-map-design.md`) explicitly requires a blueprint identity
  kept separate from dashboard card styling ("must not reuse `TemperatureCard`/dashboard card
  classes"). Pulling this redesign's card/motion language into Room Map would directly contradict
  that. It is untouched here.
- **Recipes / Cook mode** (`frontend/src/modules/recipes/`). Cook mode is a kiosk-style,
  full-screen flow with its own visual logic (large touch targets, step progress). A separate pass
  if/when needed.
- No backend, database, or API changes. No new endpoints — inline live values reuse the existing
  per-device `getLatestTelemetry` probe pattern already used by `temperature/api/temperature.ts`
  and `roomMap/api/roomMap.ts`.
- No route path changes — `/` keeps its path and `isActive` matcher; only its nav `label` and page
  title change (see "Overview page" below).

## New primitive: `LiveDot`

`frontend/src/ui/LiveDot.tsx`, replacing every `Ring` usage that represented online/offline state
(`DeviceCard.tsx`, `TemperatureCard.tsx`).

```ts
export interface LiveDotProps {
  online: boolean
  size?: number // default 10
  className?: string
}
```

- Renders a single filled `<span>`/`<div>` circle (`border-radius: 9999px`), not an SVG arc — a
  solid dot reads unambiguously as a status indicator, never as a spinner.
- `online = true`: `bg-ok`, plus the `animate-breathe` utility (see Motion system) — a slow
  opacity/scale pulse that reads as "alive," not "loading" (loading spinners are fast, ~1s;
  breathing is ~2.5s and never resolves to a fixed rotation).
- `online = false`: `bg-ink-faint`, no animation.
- Each instance picks its own negative `animation-delay` on mount (random phase within the 2.5s
  cycle), so a grid with several online devices doesn't have every dot breathing in lockstep —
  a synchronized grid-wide pulse reads as an alert/flashing pattern, not the intended "quiet
  appliance" ambient life.
- Wrapped by the caller in a `<span title="Online"|"Offline">` exactly as `Ring` was, so existing
  accessibility/tooltip behavior is unchanged.

## `Ring`'s narrowed role

`Ring` (`frontend/src/ui/Ring.tsx`) keeps its existing API and rendering unchanged. Its remaining
call sites after this redesign:
- The logo in `AppShell.tsx` (brand mark, static 78% arc).
- `Loading.tsx` (spinning, unchanged — a real loading spinner is exactly what `spinning` is for).
- Cook mode's `IngredientProgress` (progress mode, unchanged — out of scope, but noted since it's
  a legitimate progress use, not a status badge).

It is no longer used for the nav rail's active-item indicator or for any online/offline badge —
those are the two uses that made the mark ambiguous.

## Motion system

New keyframes added to `frontend/src/index.css`, alongside the existing theme-transition rule,
plus small Tailwind utility classes (arbitrary-value or `@layer utilities`, matching how the
project already avoids a Tailwind config content but keeps everything in `index.css`):

```css
@keyframes breathe {
  0%, 100% { opacity: 0.55; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1); }
}

@keyframes fade-slide-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-breathe { animation: breathe 2.5s ease-in-out infinite; }
.animate-fade-slide-in { animation: fade-slide-in 300ms ease-out both; }
```

- `animate-breathe`: used only by `LiveDot` when online.
- `animate-fade-slide-in`: used on card entrance (Overview device cards, Temperature cards). Each
  card gets a per-item `animation-delay` via inline `style={{ animationDelay: `${index * 40}ms` }}`
  capped at a small number of items (e.g. first 12) so a long grid doesn't produce a multi-second
  stagger tail.
- Hover lift: extend the existing card class from `hover:border-line-strong hover:bg-overlay` to
  additionally include `hover:-translate-y-0.5 hover:shadow-lg` with `transition` (existing
  Tailwind default duration is kept — no new duration utility needed there, this project has no
  shadow tokens today so `shadow-lg` is Tailwind's built-in, applied only on hover so it doesn't
  conflict with the flat resting-state design).
- No changes to existing `active:scale-[0.97|0.98]` press feedback — it already works well and is
  left alone.

## Nav rail (`AppShell.tsx`)

- Each `RailLink` gains a small label under the icon (`text-[10px] tracking-wide uppercase`,
  `font-display`), rendering `nav.railLabel` — a new, short field on `ModuleNav`
  (`app/modules.ts`), distinct from `nav.label` (used for the page title / `aria-label` / `title`
  tooltip). `nav.label` is the full name ("Overview", "Temperature", "Room Map", "Recipes"), which
  does not fit the rail; `railLabel` is a one-word rail-only string ("Home", "Temp", "Map", "Cook")
  set per module in each `routes.tsx`. Solves a real usability gap: this is a wall-mounted touch
  tablet, so the existing `title` tooltip (hover-only) is never seen.
- Active-item treatment changes from the `<Ring>` overlay to a filled rounded background behind
  icon + label: `bg-accent/20 text-accent rounded-2xl`, replacing the `absolute inset-0` `Ring`.
  `/20` (not `/12`) because at `/12` the fill is close to imperceptible against
  `--surface-sunken` in the light theme. Inactive stays
  `text-ink-muted hover:bg-surface-raised hover:text-ink`.
- Rail item is now a column (icon + label) instead of a fixed `size-12` circle. The rail itself
  widens from `w-16` to `w-20` to fit icon + label comfortably; height grows to fit the label
  (`min-h-14` instead of `size-12`).
- Logo `Ring` at the top is unchanged.

## Overview page (renamed from "Devices")

`frontend/src/modules/devices/routes.tsx`: `nav.label` changes from `'Devices'` to `'Overview'`.
`DashboardPage.tsx`: `PageHeader title` changes from `'Devices'` to `'Overview'`. Route path (`/`)
and `isActive` matcher are unchanged.

### Hero strip

New small block at the top of `DashboardPage.tsx`, above the grouped grid:
- Left: a `LiveDot` (aggregate — online if at least one device is online) + mono text
  `"{onlineCount}/{totalCount} devices online"`.
- Right: mono timestamp of the most recent `lastSeen` across all devices, reusing the existing
  `formatLastSeen` helper already in `DeviceCard.tsx` (hoist it to a shared location, e.g.
  `frontend/src/modules/devices/format.ts`, since both the hero strip and cards need it).
- No new API calls — computed from the same `devices` array `DashboardPage` already polls.

### Grouped sections

`DeviceGrid.tsx` groups the flat `Device[]` by `type` into a fixed section order, skipping empty
groups:

1. "Světla" — `LIGHT`
2. "Spínače a zásuvky" — `SWITCH`, `PLUG`
3. "Senzory" — `SENSOR`
4. "Ostatní" — `OTHER`

Each section renders a small uppercase label (`text-xs tracking-wide text-ink-muted`) with a thin
`border-line` rule, then that group's cards in the existing responsive grid classes. This is a
pure client-side `Array.reduce`/grouping in `DeviceGrid.tsx` — no new data fetching.

### Card updates (`DeviceCard.tsx`)

- Status badge: `Ring` → `LiveDot` (see above).
- Entrance: `animate-fade-slide-in` with staggered delay (see Motion system).
- Hover: add lift/shadow (see Motion system) on top of the existing border/bg hover.
- Inline live value for `SENSOR`-type devices only: probe `getLatestTelemetry(ieeeAddress)` the
  same way `temperature/api/temperature.ts` does, showing whichever of `temperature`/`humidity` is
  present (e.g. `"21.5°C"`, or `"21.5°C · 44%"` if both) in `font-mono text-cool` — this is the
  first real use of the `--cool` token outside chart palettes, giving sensor data its own visual
  identity distinct from `--accent` (which stays reserved for active/brand elements). Devices of
  other types keep today's card content unchanged (icon, name, vendor/model, last-seen).
- This probing happens in a new `frontend/src/modules/devices/api/deviceReadings.ts`, following the
  same shape as `getTemperatureReadings` (`temperature/api/temperature.ts`) and `getRoomReadings`
  (`roomMap/api/roomMap.ts`) — a `getDevices()` call followed by a `Promise.all` of per-`SENSOR`
  `getLatestTelemetry` probes, swallowing individual failures. `DashboardPage.tsx` calls this
  instead of the plain `getDevices()` it uses today, so `DeviceCard` stays a presentational
  component receiving an optional `liveValue?: string` prop, not doing its own fetching.

## Visual style reference

| Element | Before | After |
|---|---|---|
| Online/offline badge | `Ring` (78% arc), `text-ok`/`text-ink-faint` | `LiveDot`, `bg-ok` + breathe / `bg-ink-faint` static |
| Nav active indicator | `Ring` overlay behind icon | Filled `bg-accent/12` pill behind icon + label |
| Nav rail item | Icon only, `title` tooltip | Icon + visible label |
| Devices page name | "Devices" | "Overview" |
| Devices layout | Flat, unordered grid | Sectioned by device type, hero summary strip |
| Sensor card content | Icon + name only | + inline live reading in `text-cool` |
| Card hover | Border + background change | + `-translate-y-0.5 shadow-lg` |
| Card entrance | None (instant) | `fade-slide-in`, staggered |

No new color tokens are introduced — `--cool` and `--ok` already exist in `frontend/DESIGN.md`'s
token table and were simply underused.

## Error handling

Unchanged patterns throughout:
- The hero strip's online count and inline sensor probes use the same devices array `DashboardPage`
  already polls and already handles `loading`/`error` for — no new error states.
- A sensor device's failed telemetry probe (network error, no `temperature`/`humidity` field) is
  swallowed the same way `getTemperatureReadings` already does (`try/catch` → treated as "no live
  value," card falls back to its non-sensor content layout), never a page-level error.

## Testing

- `DeviceCard.test.tsx` (existing): update assertions that reference `Ring` status rendering to
  assert `LiveDot` instead; add a case for the inline live-value prop rendering when present/absent.
- New `LiveDot.test.tsx`: online → breathe class + `bg-ok`; offline → no animation class +
  `bg-ink-faint`.
- New test coverage for `DeviceGrid`'s grouping: devices of mixed types render under the correct
  section headers in the fixed order, and a type with zero devices renders no section/header.
- `AppShell` currently has no test file; if one is added as part of implementation, cover that the
  active nav item gets the pill class and inactive items don't (no snapshot testing of animation
  timing).
- No changes needed to `TemperaturePage`/`TemperatureCard` tests beyond the same `Ring` → `LiveDot`
  assertion swap.
