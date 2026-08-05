# Room Detail Page, Temperature Module Removal, Dynamic Home Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the standalone Temperature page. Make each Home room card a link into a new
per-room detail page showing every sensor chart and every registered device for that room. On
tablet/desktop, let the user freely drag/resize the Home room cards into a custom layout that
persists in `localStorage`.

**Architecture:** The room→device mapping already lives in `frontend/src/modules/roomMap/config/rooms.ts`
as a frontend-only config (no backend changes anywhere in this plan). It is generalized from
"sensors only" to "every device in the room". A new `RoomDetailPage` in the `home` module reuses
the existing `DeviceGrid` (device cards/controls) and two chart components extracted out of
`DeviceDetailPage` (`TelemetryFieldChart`, `ContactTimelineCard`) so the room page and the device
page share one implementation of "pick a time range, chart every telemetry field". The Home page's
free-form layout is `react-grid-layout` gated behind an edit-mode toggle that only appears at the
`sm` breakpoint and up; the static Tailwind grid stays the default render path.

**Tech Stack:** React 19, TypeScript, React Router 7, Tailwind (semantic tokens only, per
`frontend/DESIGN.md`), Vitest + Testing Library, `react-grid-layout` (new dependency).

## Global Constraints

- Frontend only (`frontend/`). No backend, database, or migration changes.
- Code style in every touched file: single quotes, no semicolons (matches all files touched by
  this plan already).
- Room device assignment for `office`:
  `['0xe456acfffe5dc028', '0x54dce9fffefa56fb', '0xa4c138518ed616e3']`. Every other room keeps `[]`.
- Drag/resize edit mode is available only at the `sm` Tailwind breakpoint and up (matches the
  existing rail-vs-bottom-bar breakpoint in `AppShell.tsx`). Below `sm`, Home renders exactly the
  static grid it renders today.
- Layout persistence is `localStorage` only, under key `home-room-layout`. No backend sync.
- New user-facing copy (empty states, buttons, not-found message) is Czech, matching the existing
  convention for dynamic/content strings in this codebase (e.g. `bez senzoru`, `zavřeno`/`otevřeno`
  in `RoomOverviewCard.tsx`, the `DeviceGrid` section labels). Back-link labels and page-chrome
  titles stay English, matching `DeviceDetailPage`'s `back={{ to: '/devices', label: 'Devices' }}`.
- Run `npm test` (= `vitest run`) and `npm run build` (= `tsc -b && vite build`) from `frontend/`
  after every task — both must pass before a task is considered done.

---

### Task 1: Generalize the room→device config field

**Files:**
- Modify: `frontend/src/modules/roomMap/config/rooms.ts`
- Modify: `frontend/src/modules/roomMap/api/roomMap.ts`
- Modify: `frontend/src/modules/roomMap/components/RoomShape.test.tsx`
- Modify: `frontend/src/modules/home/components/RoomOverviewCard.test.tsx`

**Interfaces:**
- Produces: `RoomConfig.deviceIeeeAddresses: string[]` (renamed from `sensorIeeeAddresses`), same
  shape, now holding every device in the room (sensors, lights, switches, plugs), not just
  sensors. `rooms: RoomConfig[]` keeps its exported name. Consumed by `getRoomReadings` (this
  task), and by `RoomDetailPage` in Task 5.

- [ ] **Step 1: Rename the field and add `office`'s third device in `rooms.ts`**

Replace the full contents of `frontend/src/modules/roomMap/config/rooms.ts` with:

```ts
export type RoomEdge = 'top' | 'right' | 'bottom' | 'left'

export interface RoomRect {
  /** All four values are percentages (0-100) of the floor plan container. */
  top: number
  left: number
  width: number
  height: number
  /** Edges to render without a border, e.g. an open passage to a neighboring rect (no wall/door there). */
  openEdges?: RoomEdge[]
}

export interface RoomConfig {
  id: string
  /** Not rendered on the map; used for aria-label/title only. */
  label: string
  /** device.ieeeAddress values of every device assigned to this room — sensors, lights,
   *  switches, plugs, ... — or [] if none yet. Stable across friendlyName renames — unlike
   *  friendlyName, this never changes for a device. */
  deviceIeeeAddresses: string[]
  /** One rect per room, except non-rectangular rooms (e.g. an L-shaped hallway), which use several. */
  rects: RoomRect[]
}

export const rooms: RoomConfig[] = [
  {
    id: 'bedroom',
    label: 'Ložnice',
    deviceIeeeAddresses: [],
    rects: [{ top: 0, left: 0, width: 26.7, height: 100 }],
  },
  {
    id: 'kitchen',
    label: 'Kuchyně',
    deviceIeeeAddresses: [],
    // Split so the sliver above the hallway connector can go without a bottom/left border — same
    // room on both sides of that internal seam, and the doorway down into the hallway is open.
    rects: [
      { top: 0, left: 26.7, width: 16, height: 37.5, openEdges: ['right'] },
      { top: 0, left: 42.7, width: 4, height: 37.5, openEdges: ['left', 'bottom'] },
    ],
  },
  {
    id: 'wc',
    label: 'WC',
    deviceIeeeAddresses: [],
    rects: [{ top: 37.5, left: 26.7, width: 8, height: 37.5 }],
  },
  {
    id: 'bathroom',
    label: 'Koupelna',
    deviceIeeeAddresses: [],
    rects: [{ top: 37.5, left: 34.7, width: 8, height: 37.5 }],
  },
  {
    id: 'hallway',
    label: 'Chodba',
    deviceIeeeAddresses: [],
    // L-shaped: main strip split at the connector's width so that seam and the doorway up into the
    // kitchen can go without a border — no wall/door at either, it's one open room.
    rects: [
      { top: 75, left: 26.7, width: 16, height: 25, openEdges: ['right'] },
      { top: 75, left: 42.7, width: 4, height: 25, openEdges: ['left', 'top'] },
      { top: 37.5, left: 42.7, width: 4, height: 37.5, openEdges: ['top', 'bottom'] },
    ],
  },
  {
    id: 'living-room',
    label: 'Obývák',
    deviceIeeeAddresses: [],
    rects: [{ top: 0, left: 46.7, width: 26.7, height: 100 }],
  },
  {
    id: 'office',
    label: 'Pracovna',
    deviceIeeeAddresses: ['0xe456acfffe5dc028', '0x54dce9fffefa56fb', '0xa4c138518ed616e3'],
    rects: [{ top: 0, left: 73.4, width: 26.6, height: 100 }],
  },
]
```

- [ ] **Step 2: Update `roomMap.ts` to loop over the renamed field**

In `frontend/src/modules/roomMap/api/roomMap.ts`, replace:

```ts
      for (const sensorIeeeAddress of room.sensorIeeeAddresses) {
        const device = devices.find((d) => d.ieeeAddress === sensorIeeeAddress)
```

with:

```ts
      for (const deviceIeeeAddress of room.deviceIeeeAddresses) {
        const device = devices.find((d) => d.ieeeAddress === deviceIeeeAddress)
```

- [ ] **Step 3: Rename the field in `RoomShape.test.tsx` fixtures**

In `frontend/src/modules/roomMap/components/RoomShape.test.tsx`, there are three occurrences of
`sensorIeeeAddresses` — the `room` fixture, the `lShapedRoom` fixture, and the override in the
"no data" test. Rename all three to `deviceIeeeAddresses`:

```ts
const room: RoomConfig = {
  id: 'office',
  label: 'Pracovna',
  deviceIeeeAddresses: ['0xe456acfffe5dc028'],
  rects: [{ top: 0, left: 66.6, width: 33.4, height: 100 }],
}

const lShapedRoom: RoomConfig = {
  id: 'hallway',
  label: 'Chodba',
  deviceIeeeAddresses: [],
  rects: [
    { top: 75, left: 26.7, width: 20, height: 25 },
    { top: 37.5, left: 42.7, width: 4, height: 37.5 },
  ],
}
```

and:

```ts
    const reading: RoomReading = { room: { ...room, deviceIeeeAddresses: [] } }
```

- [ ] **Step 4: Rename the field in `RoomOverviewCard.test.tsx`'s `room()` helper**

In `frontend/src/modules/home/components/RoomOverviewCard.test.tsx`, rename the two occurrences of
`sensorIeeeAddresses` to `deviceIeeeAddresses` — the default in the `room()` helper, and the
override in the "no sensor" test:

```ts
function room(overrides: Partial<RoomConfig> = {}): RoomConfig {
  return {
    id: 'office',
    label: 'Pracovna',
    deviceIeeeAddresses: ['0xe456acfffe5dc028', '0x54dce9fffefa56fb'],
    rects: [{ top: 0, left: 0, width: 100, height: 100 }],
    ...overrides,
  }
}
```

and:

```ts
    const reading: RoomReading = { room: room({ deviceIeeeAddresses: [] }) }
```

- [ ] **Step 5: Run the test suite and the production build**

Run: `cd frontend && npm test && npm run build`
Expected: PASS — all existing suites still pass (none of them assert on the field name itself,
only on rendered output), and the TypeScript build is clean.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/roomMap/config/rooms.ts frontend/src/modules/roomMap/api/roomMap.ts frontend/src/modules/roomMap/components/RoomShape.test.tsx frontend/src/modules/home/components/RoomOverviewCard.test.tsx
git commit -m "feat: generalize room config to hold every device, not just sensors"
```

---

### Task 2: Make `RoomOverviewCard` a link to its room

**Files:**
- Modify: `frontend/src/modules/home/components/RoomOverviewCard.tsx`
- Modify: `frontend/src/modules/home/components/RoomOverviewCard.test.tsx`
- Modify: `frontend/src/modules/home/pages/RoomOverviewPage.test.tsx`

**Interfaces:**
- Consumes: `RoomReading` from `@/modules/roomMap/api/roomMap` (unchanged).
- Produces: `RoomOverviewCard({ reading: RoomReading; linkable?: boolean })`. Default
  `linkable = true` renders a `react-router-dom` `Link` to `/room/{room.id}`. `linkable={false}`
  renders the same visual content as a plain, non-navigating `div` — used by the Home edit-mode
  grid in Task 8, where the card must be draggable instead of clickable. `RoomDetailPage` (Task 5)
  registers the `/room/:id` route this links to.

- [ ] **Step 1: Add failing tests for the link behavior**

Replace the full contents of `frontend/src/modules/home/components/RoomOverviewCard.test.tsx`
with:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { RoomOverviewCard } from './RoomOverviewCard'
import type { RoomReading } from '@/modules/roomMap/api/roomMap'
import type { RoomConfig } from '@/modules/roomMap/config/rooms'

function room(overrides: Partial<RoomConfig> = {}): RoomConfig {
  return {
    id: 'office',
    label: 'Pracovna',
    deviceIeeeAddresses: ['0xe456acfffe5dc028', '0x54dce9fffefa56fb'],
    rects: [{ top: 0, left: 0, width: 100, height: 100 }],
    ...overrides,
  }
}

function renderCard(reading: RoomReading, linkable?: boolean) {
  return render(
    <MemoryRouter>
      <RoomOverviewCard reading={reading} linkable={linkable} />
    </MemoryRouter>,
  )
}

describe('RoomOverviewCard', () => {
  it('shows temperature, humidity, and a closed badge when all three are reported', () => {
    const reading: RoomReading = { room: room(), temperature: 21.4, humidity: 48, contact: true }

    renderCard(reading)

    expect(screen.getByText('Pracovna')).toBeInTheDocument()
    expect(screen.getByText('21.4°')).toBeInTheDocument()
    expect(screen.getByText('48%')).toBeInTheDocument()
    expect(screen.getByText('zavřeno')).toBeInTheDocument()
  })

  it('shows an open badge when contact is false', () => {
    const reading: RoomReading = { room: room(), contact: false }

    renderCard(reading)

    expect(screen.getByText('otevřeno')).toBeInTheDocument()
  })

  it('omits humidity and the door badge when only temperature is reported', () => {
    const reading: RoomReading = { room: room(), temperature: 19.0 }

    renderCard(reading)

    expect(screen.getByText('19.0°')).toBeInTheDocument()
    expect(screen.queryByText('%')).not.toBeInTheDocument()
    expect(screen.queryByText('zavřeno')).not.toBeInTheDocument()
    expect(screen.queryByText('otevřeno')).not.toBeInTheDocument()
  })

  it('renders a muted "no sensor" state when nothing is reported', () => {
    const reading: RoomReading = { room: room({ deviceIeeeAddresses: [] }) }

    renderCard(reading)

    expect(screen.getByText('Pracovna')).toBeInTheDocument()
    expect(screen.getByText('bez senzoru')).toBeInTheDocument()
  })

  it('links to the room detail page by default', () => {
    const reading: RoomReading = { room: room() }

    renderCard(reading)

    expect(screen.getByRole('link')).toHaveAttribute('href', '/room/office')
  })

  it('renders as a plain, non-navigating container when linkable is false', () => {
    const reading: RoomReading = { room: room() }

    renderCard(reading, false)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('Pracovna')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify the new cases fail**

Run: `cd frontend && npm test -- RoomOverviewCard.test.tsx`
Expected: FAIL — the two new tests fail because `RoomOverviewCard` doesn't render a link yet
(`getByRole('link')` finds nothing).

- [ ] **Step 3: Implement the `Link`/`linkable` behavior**

Replace the full contents of `frontend/src/modules/home/components/RoomOverviewCard.tsx` with:

```tsx
import { Link } from 'react-router-dom'
import type { RoomReading } from '@/modules/roomMap/api/roomMap'

export function RoomOverviewCard({
  reading,
  linkable = true,
}: {
  reading: RoomReading
  linkable?: boolean
}) {
  const { room, temperature, humidity, contact } = reading
  const hasData = temperature !== undefined || humidity !== undefined || contact !== undefined

  const content = (
    <>
      <h3 className={`truncate text-sm ${hasData ? 'text-ink-muted' : 'text-ink-faint'}`}>{room.label}</h3>

      {hasData ? (
        <div className="mt-2">
          {temperature !== undefined && (
            <p className="font-mono text-2xl font-semibold tabular-nums text-warm">{temperature.toFixed(1)}°</p>
          )}
          {(humidity !== undefined || contact !== undefined) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs">
              {humidity !== undefined && <span className="tabular-nums text-cool">{Math.round(humidity)}%</span>}
              {contact !== undefined && (
                <span
                  className={`rounded-full border px-2 py-0.5 ${
                    contact ? 'border-ok/40 bg-ok/10 text-ok' : 'border-danger/40 bg-danger/10 text-danger'
                  }`}
                >
                  {contact ? 'zavřeno' : 'otevřeno'}
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-2 font-mono text-xs text-ink-faint">bez senzoru</p>
      )}
    </>
  )

  const className = `block h-full rounded-2xl border p-4 transition ${
    hasData ? 'border-line bg-surface-raised' : 'border-line/60 bg-surface-raised/40'
  } ${linkable ? 'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lg active:scale-[0.98]' : ''}`

  if (!linkable) {
    return <div className={className}>{content}</div>
  }

  return (
    <Link to={`/room/${room.id}`} className={className}>
      {content}
    </Link>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm test -- RoomOverviewCard.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Fix `RoomOverviewPage.test.tsx` for the new `Link` dependency**

`RoomOverviewCard` now calls `react-router-dom`'s `Link`, which throws without a Router ancestor.
Replace the full contents of `frontend/src/modules/home/pages/RoomOverviewPage.test.tsx` with:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomOverviewPage } from './RoomOverviewPage'

const DEVICES_PATH = '/api/devices'

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}

describe('RoomOverviewPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders one card per configured room, including rooms without a sensor', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === DEVICES_PATH) return Promise.resolve(jsonResponse([]))
      return Promise.resolve(new Response('not found', { status: 404 }))
    })

    render(
      <MemoryRouter>
        <RoomOverviewPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('Pracovna')).toBeInTheDocument())
    expect(screen.getByText('Ložnice')).toBeInTheDocument()
    expect(screen.getByText('Kuchyně')).toBeInTheDocument()
    expect(screen.getAllByText('bez senzoru').length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 6: Run the full test suite and the production build**

Run: `cd frontend && npm test && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/modules/home/components/RoomOverviewCard.tsx frontend/src/modules/home/components/RoomOverviewCard.test.tsx frontend/src/modules/home/pages/RoomOverviewPage.test.tsx
git commit -m "feat: link Home room cards to a room detail page"
```

---

### Task 3: Extract shared per-field telemetry chart components

**Files:**
- Create: `frontend/src/modules/devices/components/TelemetryFieldChart.tsx`
- Create: `frontend/src/modules/devices/components/ContactTimelineCard.tsx`
- Modify: `frontend/src/modules/devices/pages/DeviceDetailPage.tsx`

**Interfaces:**
- Produces: `TelemetryFieldChart({ deviceKey: string; field: string; range: TimeRange })` and
  `ContactTimelineCard({ deviceKey: string; range: TimeRange; currentValue?: number })`, both
  exported from `frontend/src/modules/devices/components/`. Consumed by `DeviceDetailPage`
  (this task) and by `RoomDeviceTelemetry` (Task 4).
- Consumes: `usePolling` from `@/hooks/usePolling`; `getTelemetryHistory`, `getRangeBounds` from
  `../api/telemetry`; `TelemetryChart` from `./TelemetryChart`; `ContactTimeline` from
  `./ContactTimeline`; `TimeRange` from `../types/telemetry` — all unchanged, existing exports.

This is a pure move: the two components are copied byte-for-byte out of `DeviceDetailPage.tsx`
into their own files, then deleted from `DeviceDetailPage.tsx` and imported instead. No behavior
changes, so there are no new tests — `DeviceDetailPage` has no existing test file to keep green,
and the extraction is verified by the build and a manual check (Step 5).

- [ ] **Step 1: Create `TelemetryFieldChart.tsx`**

Create `frontend/src/modules/devices/components/TelemetryFieldChart.tsx`:

```tsx
import { usePolling } from '@/hooks/usePolling'
import { getTelemetryHistory } from '../api/telemetry'
import type { TimeRange } from '../types/telemetry'
import { TelemetryChart } from './TelemetryChart'

const REFRESH_INTERVAL_MS = 15_000

export function TelemetryFieldChart({
  deviceKey,
  field,
  range,
}: {
  deviceKey: string
  field: string
  range: TimeRange
}) {
  const { data } = usePolling(() => getTelemetryHistory(deviceKey, field, range), REFRESH_INTERVAL_MS, [
    deviceKey,
    field,
    range,
  ])

  return (
    <div className="rounded-2xl border border-line bg-surface-raised p-4">
      <h3 className="mb-3 font-mono text-xs tracking-wider text-ink-muted uppercase">{field}</h3>
      <TelemetryChart field={field} points={data?.points ?? []} />
    </div>
  )
}
```

- [ ] **Step 2: Create `ContactTimelineCard.tsx`**

Create `frontend/src/modules/devices/components/ContactTimelineCard.tsx`:

```tsx
import { usePolling } from '@/hooks/usePolling'
import { getRangeBounds, getTelemetryHistory } from '../api/telemetry'
import type { TimeRange } from '../types/telemetry'
import { ContactTimeline } from './ContactTimeline'

const REFRESH_INTERVAL_MS = 15_000

export function ContactTimelineCard({
  deviceKey,
  range,
  currentValue,
}: {
  deviceKey: string
  range: TimeRange
  currentValue?: number
}) {
  const { data } = usePolling(() => getTelemetryHistory(deviceKey, 'contact', range), REFRESH_INTERVAL_MS, [
    deviceKey,
    range,
  ])
  const { from, to } = getRangeBounds(range)

  return (
    <div className="rounded-2xl border border-line bg-surface-raised p-4">
      <h3 className="mb-3 font-mono text-xs tracking-wider text-ink-muted uppercase">contact</h3>
      <ContactTimeline
        points={data?.points ?? []}
        fromMs={from.getTime()}
        toMs={to.getTime()}
        currentValue={currentValue}
      />
    </div>
  )
}
```

- [ ] **Step 3: Update `DeviceDetailPage.tsx` to import instead of define them**

In `frontend/src/modules/devices/pages/DeviceDetailPage.tsx`, replace the import block:

```ts
import { getLatestTelemetry, getRangeBounds, getTelemetryHistory } from '../api/telemetry'
import { ContactTimeline } from '../components/ContactTimeline'
import { TelemetryChart } from '../components/TelemetryChart'
import { sortFieldsForDisplay } from '../lib/fieldOrder'
```

with:

```ts
import { getLatestTelemetry } from '../api/telemetry'
import { ContactTimelineCard } from '../components/ContactTimelineCard'
import { TelemetryFieldChart } from '../components/TelemetryFieldChart'
import { sortFieldsForDisplay } from '../lib/fieldOrder'
```

Then delete the two function definitions at the end of the file — everything from the blank line
right after the component's closing `}` through the end of the file:

```tsx
function TelemetryFieldChart({
  deviceKey,
  field,
  range,
}: {
  deviceKey: string
  field: string
  range: TimeRange
}) {
  const { data } = usePolling(() => getTelemetryHistory(deviceKey, field, range), REFRESH_INTERVAL_MS, [
    deviceKey,
    field,
    range,
  ])

  return (
    <div className="rounded-2xl border border-line bg-surface-raised p-4">
      <h3 className="mb-3 font-mono text-xs tracking-wider text-ink-muted uppercase">{field}</h3>
      <TelemetryChart field={field} points={data?.points ?? []} />
    </div>
  )
}

function ContactTimelineCard({
  deviceKey,
  range,
  currentValue,
}: {
  deviceKey: string
  range: TimeRange
  currentValue?: number
}) {
  const { data } = usePolling(() => getTelemetryHistory(deviceKey, 'contact', range), REFRESH_INTERVAL_MS, [
    deviceKey,
    range,
  ])
  const { from, to } = getRangeBounds(range)

  return (
    <div className="rounded-2xl border border-line bg-surface-raised p-4">
      <h3 className="mb-3 font-mono text-xs tracking-wider text-ink-muted uppercase">contact</h3>
      <ContactTimeline
        points={data?.points ?? []}
        fromMs={from.getTime()}
        toMs={to.getTime()}
        currentValue={currentValue}
      />
    </div>
  )
}
```

Delete all of the above (both functions, and the blank line separating them from the main
component) — nothing replaces it, the file simply ends at the main component's closing `}`.

The rest of `DeviceDetailPage.tsx` (the main `DeviceDetailPage` function body, including its
`<ContactTimelineCard .../>` and `<TelemetryFieldChart .../>` JSX usages) is unchanged — those
JSX calls now resolve to the imported components instead of the file-local ones, with identical
props.

- [ ] **Step 4: Run the test suite and the production build**

Run: `cd frontend && npm test && npm run build`
Expected: PASS. `REFRESH_INTERVAL_MS` and `TimeRange` are still used elsewhere in
`DeviceDetailPage.tsx` (the page's own `usePolling` calls and `TIME_RANGES` constant), so no
unused-import errors are expected there; double-check the build output is clean if anything looks
unused.

- [ ] **Step 5: Manual smoke check**

Run: `cd frontend && npm run dev`, open a device detail page for a sensor with telemetry
(`/device/:id`), and confirm the charts and contact timeline still render exactly as before the
extraction.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/devices/components/TelemetryFieldChart.tsx frontend/src/modules/devices/components/ContactTimelineCard.tsx frontend/src/modules/devices/pages/DeviceDetailPage.tsx
git commit -m "refactor: extract TelemetryFieldChart and ContactTimelineCard out of DeviceDetailPage"
```

---

### Task 4: Add `RoomDeviceTelemetry`

**Files:**
- Create: `frontend/src/modules/home/components/RoomDeviceTelemetry.tsx`
- Create: `frontend/src/modules/home/components/RoomDeviceTelemetry.test.tsx`

**Interfaces:**
- Consumes: `usePolling` from `@/hooks/usePolling`; `getLatestTelemetry` from
  `@/modules/devices/api/telemetry`; `ContactTimelineCard`, `TelemetryFieldChart` from
  `@/modules/devices/components/...` (Task 3); `sortFieldsForDisplay` from
  `@/modules/devices/lib/fieldOrder`; `Device` from `@/modules/devices/types/device`; `TimeRange`
  from `@/modules/devices/types/telemetry`.
- Produces: `RoomDeviceTelemetry({ device: Device; range: TimeRange })`. Renders nothing
  (`null`) if the device has no `contact` field and no other telemetry fields. Otherwise renders
  the device's friendly name as a heading, then the same contact-timeline / per-field-chart layout
  `DeviceDetailPage` uses for a single device. Consumed by `RoomDetailPage` (Task 5), once per
  sensor device in the room.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/modules/home/components/RoomDeviceTelemetry.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomDeviceTelemetry } from './RoomDeviceTelemetry'
import type { Device } from '@/modules/devices/types/device'

function device(overrides: Partial<Device> = {}): Device {
  return {
    id: 1,
    ieeeAddress: '0xaaa',
    friendlyName: 'Office temp',
    type: 'SENSOR',
    vendor: null,
    model: null,
    available: true,
    lastSeen: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}

describe('RoomDeviceTelemetry', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders nothing for a device with no telemetry fields', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ deviceName: 'Office temp', values: {}, lastUpdated: null }),
    )

    const { container } = render(<RoomDeviceTelemetry device={device()} range="24h" />)

    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the device name and a contact badge for a device reporting contact', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ deviceName: 'Office door', values: { contact: 1 }, lastUpdated: '2026-08-05T10:00:00Z' }),
    )

    render(<RoomDeviceTelemetry device={device({ friendlyName: 'Office door' })} range="24h" />)

    expect(await screen.findByText('Office door')).toBeInTheDocument()
    expect(screen.getByText('zavřeno')).toBeInTheDocument()
  })

  it('shows a field chart heading for a device reporting a non-contact field', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ deviceName: 'Office temp', values: { temperature: 21.5 }, lastUpdated: '2026-08-05T10:00:00Z' }),
    )

    render(<RoomDeviceTelemetry device={device()} range="24h" />)

    expect(await screen.findByText('Office temp')).toBeInTheDocument()
    expect(screen.getByText('temperature')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- RoomDeviceTelemetry.test.tsx`
Expected: FAIL — `Failed to resolve import "./RoomDeviceTelemetry"` (file doesn't exist yet).

- [ ] **Step 3: Implement `RoomDeviceTelemetry.tsx`**

Create `frontend/src/modules/home/components/RoomDeviceTelemetry.tsx`:

```tsx
import { usePolling } from '@/hooks/usePolling'
import { getLatestTelemetry } from '@/modules/devices/api/telemetry'
import { ContactTimelineCard } from '@/modules/devices/components/ContactTimelineCard'
import { TelemetryFieldChart } from '@/modules/devices/components/TelemetryFieldChart'
import { sortFieldsForDisplay } from '@/modules/devices/lib/fieldOrder'
import type { Device } from '@/modules/devices/types/device'
import type { TimeRange } from '@/modules/devices/types/telemetry'

const REFRESH_INTERVAL_MS = 15_000

export function RoomDeviceTelemetry({ device, range }: { device: Device; range: TimeRange }) {
  const { data: latest } = usePolling(
    () => getLatestTelemetry(device.ieeeAddress),
    REFRESH_INTERVAL_MS,
    [device.ieeeAddress],
  )

  const allFields = latest ? Object.keys(latest.values) : []
  const hasContact = allFields.includes('contact')
  const chartFields = sortFieldsForDisplay(allFields.filter((f) => f !== 'contact'))

  if (!hasContact && chartFields.length === 0) return null

  return (
    <div>
      <h3 className="mb-3 text-sm text-ink-muted">{device.friendlyName}</h3>

      {hasContact && (
        <div className="mb-4">
          <ContactTimelineCard deviceKey={device.ieeeAddress} range={range} currentValue={latest?.values.contact} />
        </div>
      )}

      {chartFields.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {chartFields.map((field) => (
            <TelemetryFieldChart key={field} deviceKey={device.ieeeAddress} field={field} range={range} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm test -- RoomDeviceTelemetry.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/home/components/RoomDeviceTelemetry.tsx frontend/src/modules/home/components/RoomDeviceTelemetry.test.tsx
git commit -m "feat: add per-device telemetry section for the room detail page"
```

---

### Task 5: Add `RoomDetailPage` and wire its route

**Files:**
- Create: `frontend/src/modules/home/pages/RoomDetailPage.tsx`
- Create: `frontend/src/modules/home/pages/RoomDetailPage.test.tsx`
- Modify: `frontend/src/modules/home/routes.tsx`

**Interfaces:**
- Consumes: `useParams` from `react-router-dom`; `rooms` from
  `@/modules/roomMap/config/rooms` (Task 1); `getDeviceReadings` from
  `@/modules/devices/api/deviceReadings`; `DeviceGrid` from
  `@/modules/devices/components/DeviceGrid`; `RoomDeviceTelemetry` from `../components/RoomDeviceTelemetry`
  (Task 4); `TimeRange` from `@/modules/devices/types/telemetry`.
- Produces: `RoomDetailPage()`, registered at route path `/room/:id` in
  `frontend/src/modules/home/routes.tsx` — the target of `RoomOverviewCard`'s link (Task 2).

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/modules/home/pages/RoomDetailPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomDetailPage } from './RoomDetailPage'

const DEVICES_PATH = '/api/devices'

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}

function device(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    ieeeAddress: '0x1',
    friendlyName: 'device',
    type: 'LIGHT',
    vendor: null,
    model: null,
    available: true,
    lastSeen: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function renderRoom(roomId: string) {
  return render(
    <MemoryRouter initialEntries={[`/room/${roomId}`]}>
      <Routes>
        <Route path="/room/:id" element={<RoomDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RoomDetailPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows an empty state for a room with no assigned devices', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === DEVICES_PATH) return Promise.resolve(jsonResponse([]))
      return Promise.resolve(new Response('not found', { status: 404 }))
    })

    renderRoom('living-room')

    expect(
      await screen.findByText('V tomto pokoji nejsou zaregistrovaná žádná zařízení.'),
    ).toBeInTheDocument()
  })

  it('shows a not-found message for an unknown room id', async () => {
    vi.mocked(fetch).mockImplementation(() => Promise.resolve(jsonResponse([])))

    renderRoom('does-not-exist')

    expect(await screen.findByText('Pokoj nenalezen')).toBeInTheDocument()
  })

  it('renders the room device grid and a telemetry section for an assigned sensor', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === DEVICES_PATH) {
        return Promise.resolve(
          jsonResponse([
            device({ id: 1, ieeeAddress: '0xe456acfffe5dc028', friendlyName: 'Office temp', type: 'SENSOR' }),
            device({ id: 2, ieeeAddress: '0x54dce9fffefa56fb', friendlyName: 'Office door', type: 'SENSOR' }),
            device({ id: 3, ieeeAddress: '0xa4c138518ed616e3', friendlyName: 'Office lamp', type: 'LIGHT' }),
          ]),
        )
      }
      if (url === '/api/telemetry/0xe456acfffe5dc028/latest') {
        return Promise.resolve(
          jsonResponse({ deviceName: 'Office temp', values: { temperature: 21.5 }, lastUpdated: '2026-08-05T10:00:00Z' }),
        )
      }
      if (url === '/api/telemetry/0x54dce9fffefa56fb/latest') {
        return Promise.resolve(
          jsonResponse({ deviceName: 'Office door', values: { contact: 1 }, lastUpdated: '2026-08-05T10:00:00Z' }),
        )
      }
      return Promise.resolve(new Response('not found', { status: 404 }))
    })

    renderRoom('office')

    expect(await screen.findByText('Office lamp')).toBeInTheDocument()
    expect(screen.getByText('24h')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('zavřeno')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- RoomDetailPage.test.tsx`
Expected: FAIL — `Failed to resolve import "./RoomDetailPage"` (file doesn't exist yet).

- [ ] **Step 3: Implement `RoomDetailPage.tsx`**

Create `frontend/src/modules/home/pages/RoomDetailPage.tsx`:

```tsx
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { getDeviceReadings } from '@/modules/devices/api/deviceReadings'
import { DeviceGrid } from '@/modules/devices/components/DeviceGrid'
import type { TimeRange } from '@/modules/devices/types/telemetry'
import { rooms } from '@/modules/roomMap/config/rooms'
import { usePolling } from '@/hooks/usePolling'
import { Loading } from '@/ui/Loading'
import { PageHeader } from '@/ui/PageHeader'
import { RoomDeviceTelemetry } from '../components/RoomDeviceTelemetry'

const REFRESH_INTERVAL_MS = 15_000
const TIME_RANGES: TimeRange[] = ['1h', '6h', '24h', '7d']

export function RoomDetailPage() {
  const { id } = useParams<{ id: string }>()
  const room = rooms.find((r) => r.id === id)
  const [range, setRange] = useState<TimeRange>('24h')
  const { data: readings, error, loading } = usePolling(getDeviceReadings, REFRESH_INTERVAL_MS)

  if (!room) {
    return (
      <div className="h-full overflow-y-auto px-6 py-5 lg:px-8">
        <PageHeader title="Pokoj nenalezen" back={{ to: '/', label: 'Home' }} />
      </div>
    )
  }

  if (room.deviceIeeeAddresses.length === 0) {
    return (
      <div className="h-full overflow-y-auto px-6 py-5 lg:px-8">
        <PageHeader title={room.label} back={{ to: '/', label: 'Home' }} />
        <p className="text-ink-muted">V tomto pokoji nejsou zaregistrovaná žádná zařízení.</p>
      </div>
    )
  }

  const roomReadings = readings?.filter((r) => room.deviceIeeeAddresses.includes(r.device.ieeeAddress)) ?? []
  const hasSensor = roomReadings.some((r) => r.device.type === 'SENSOR')

  return (
    <div className="h-full overflow-y-auto px-6 py-5 lg:px-8">
      <PageHeader title={room.label} back={{ to: '/', label: 'Home' }} />

      {loading && !readings && <Loading label="Načítám pokoj…" />}
      {error && <p className="text-danger">Failed to load room data: {error.message}</p>}

      {readings && (
        <>
          <DeviceGrid readings={roomReadings} />

          {hasSensor && (
            <div className="mt-8">
              <div className="mb-4 inline-flex rounded-xl border border-line bg-surface-raised p-1">
                {TIME_RANGES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={`min-h-10 rounded-lg px-4 font-mono text-sm transition ${
                      range === r ? 'bg-accent text-accent-ink' : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-6">
                {roomReadings
                  .filter((r) => r.device.type === 'SENSOR')
                  .map((r) => (
                    <RoomDeviceTelemetry key={r.device.id} device={r.device} range={range} />
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Register the `/room/:id` route**

Replace the full contents of `frontend/src/modules/home/routes.tsx` with:

```tsx
import type { ModuleManifest } from '@/app/modules'
import { IconHome } from '@/ui/icons'
import { RoomDetailPage } from './pages/RoomDetailPage'
import { RoomOverviewPage } from './pages/RoomOverviewPage'

export const homeModule: ModuleManifest = {
  nav: {
    to: '/',
    label: 'Home',
    railLabel: 'Home',
    icon: IconHome,
    isActive: (pathname) => pathname === '/' || pathname.startsWith('/room/'),
  },
  routes: [
    { path: '/', element: <RoomOverviewPage /> },
    { path: '/room/:id', element: <RoomDetailPage /> },
  ],
}
```

(`isActive` now also matches `/room/:id` so the rail keeps the Home icon highlighted while looking
at a room's detail page — the same pattern `devicesModule` already uses for `/device/:id`.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npm test -- RoomDetailPage.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 6: Run the full test suite and the production build**

Run: `cd frontend && npm test && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/modules/home/pages/RoomDetailPage.tsx frontend/src/modules/home/pages/RoomDetailPage.test.tsx frontend/src/modules/home/routes.tsx
git commit -m "feat: add room detail page showing its devices and sensor charts"
```

---

### Task 6: Delete the Temperature module

**Files:**
- Delete: `frontend/src/modules/temperature/routes.tsx`
- Delete: `frontend/src/modules/temperature/pages/TemperaturePage.tsx`
- Delete: `frontend/src/modules/temperature/components/TemperatureCard.tsx`
- Delete: `frontend/src/modules/temperature/api/temperature.ts`
- Modify: `frontend/src/app/modules.ts`

**Interfaces:** None — nothing outside `modules/temperature/` imports from it except
`app/modules.ts`, which is updated in this task.

- [ ] **Step 1: Delete the module directory**

```bash
git rm -r frontend/src/modules/temperature
```

- [ ] **Step 2: Remove it from the shell module list**

Replace the full contents of `frontend/src/app/modules.ts` with:

```ts
import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router-dom'
import { calendarModule } from '@/modules/calendar/routes'
import { devicesModule } from '@/modules/devices/routes'
import { homeModule } from '@/modules/home/routes'
import { recipesModule } from '@/modules/recipes/routes'
import { roomMapModule } from '@/modules/roomMap/routes'
import { shoppingModule } from '@/modules/shopping/routes'
import { todoModule } from '@/modules/todo/routes'

export interface ModuleNav {
  to: string
  label: string
  /** Short label rendered under the rail icon — the rail is only 80px wide, `label` can be too long. */
  railLabel: string
  icon: ComponentType<{ className?: string }>
  /** Which pathnames light this module up in the rail. */
  isActive: (pathname: string) => boolean
}

export interface ModuleManifest {
  nav: ModuleNav
  routes: RouteObject[]
}

/**
 * Feature modules rendered inside the shared shell, in rail order.
 * A new module ships a `routes.tsx` manifest and registers itself here.
 * Kiosk-style routes (no shell) are composed separately in App.tsx.
 */
export const shellModules: ModuleManifest[] = [
  homeModule,
  devicesModule,
  roomMapModule,
  recipesModule,
  shoppingModule,
  todoModule,
  calendarModule,
]
```

- [ ] **Step 3: Run the full test suite and the production build**

Run: `cd frontend && npm test && npm run build`
Expected: PASS — no references to `modules/temperature` remain anywhere.

- [ ] **Step 4: Commit**

```bash
git add -A frontend/src/modules/temperature frontend/src/app/modules.ts
git commit -m "feat: remove the standalone Temperature page"
```

---

### Task 7: Add `react-grid-layout` and a `localStorage`-backed layout store

**Files:**
- Modify: `frontend/package.json` (via `npm install`)
- Create: `frontend/src/modules/home/lib/roomLayoutStorage.ts`
- Create: `frontend/src/modules/home/lib/roomLayoutStorage.test.ts`

**Interfaces:**
- Produces: `loadRoomLayout(): Layouts | null`, `saveRoomLayout(layouts: Layouts): void`,
  `clearRoomLayout(): void`, all from `frontend/src/modules/home/lib/roomLayoutStorage.ts`, using
  the `Layouts` type from the `react-grid-layout` package. Consumed by `RoomOverviewPage` in
  Task 8.

- [ ] **Step 1: Install the dependency**

```bash
cd frontend && npm install react-grid-layout
```

Expected: `frontend/package.json` gains `"react-grid-layout": "^2.2.4"` (or newer) under
`dependencies`, and `package-lock.json` is updated. `react-resizable` is pulled in transitively —
no separate install needed.

- [ ] **Step 2: Write the failing tests for the layout store**

Create `frontend/src/modules/home/lib/roomLayoutStorage.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { clearRoomLayout, loadRoomLayout, saveRoomLayout } from './roomLayoutStorage'

describe('roomLayoutStorage', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('returns null when nothing has been saved', () => {
    expect(loadRoomLayout()).toBeNull()
  })

  it('round-trips a saved layout', () => {
    const layouts = { lg: [{ i: 'office', x: 0, y: 0, w: 1, h: 1 }] }

    saveRoomLayout(layouts)

    expect(loadRoomLayout()).toEqual(layouts)
  })

  it('returns null after the layout is cleared', () => {
    saveRoomLayout({ lg: [{ i: 'office', x: 0, y: 0, w: 1, h: 1 }] })

    clearRoomLayout()

    expect(loadRoomLayout()).toBeNull()
  })

  it('returns null for corrupted stored JSON instead of throwing', () => {
    localStorage.setItem('home-room-layout', '{not-json')

    expect(loadRoomLayout()).toBeNull()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd frontend && npm test -- roomLayoutStorage.test.ts`
Expected: FAIL — `Failed to resolve import "./roomLayoutStorage"` (file doesn't exist yet).

- [ ] **Step 4: Implement `roomLayoutStorage.ts`**

Create `frontend/src/modules/home/lib/roomLayoutStorage.ts`:

```ts
import type { Layouts } from 'react-grid-layout'

const STORAGE_KEY = 'home-room-layout'

export function loadRoomLayout(): Layouts | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as Layouts
  } catch {
    return null
  }
}

export function saveRoomLayout(layouts: Layouts): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts))
}

export function clearRoomLayout(): void {
  localStorage.removeItem(STORAGE_KEY)
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npm test -- roomLayoutStorage.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/modules/home/lib/roomLayoutStorage.ts frontend/src/modules/home/lib/roomLayoutStorage.test.ts
git commit -m "feat: add react-grid-layout and a localStorage-backed room layout store"
```

---

### Task 8: Wire drag/resize edit mode into the Home page

**Files:**
- Modify: `frontend/src/modules/home/pages/RoomOverviewPage.tsx`
- Modify: `frontend/src/modules/home/pages/RoomOverviewPage.test.tsx`
- Modify: `frontend/src/ui/icons.tsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: `loadRoomLayout`, `saveRoomLayout`, `clearRoomLayout` from `../lib/roomLayoutStorage`
  (Task 7); `RoomOverviewCard({ reading, linkable })` (Task 2); `Button` from `@/ui/Button`;
  `Responsive`, `WidthProvider` from `react-grid-layout` (Task 7).
- Produces: two new icon exports, `IconPencil` and `IconRefreshCcw`, from `frontend/src/ui/icons.tsx`.

- [ ] **Step 1: Add the two new icons**

In `frontend/src/ui/icons.tsx`, append after the existing `IconCalendar` export:

```tsx
export function IconPencil(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h4.5L19.5 9a2.1 2.1 0 0 0-4.5-4.5L4 15.5z" />
      <path d="m13.5 6.5 4 4" />
    </Icon>
  )
}

export function IconRefreshCcw(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12a8 8 0 0 1 14-5.2M4 12a8 8 0 0 0 14 5.2" />
      <path d="M18 3.5v4h-4M6 20.5v-4h4" />
    </Icon>
  )
}
```

- [ ] **Step 2: Add `react-grid-layout` style overrides**

Append to the end of `frontend/src/index.css`:

```css
/*
 * react-grid-layout overrides — restyle the vendor package's resize handle and
 * drag placeholder using our semantic tokens instead of its packaged icon/colors.
 */
.react-grid-item > .react-resizable-handle {
  background-image: none;
}

.react-grid-item > .react-resizable-handle::after {
  content: '';
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--line-strong);
  border-bottom: 2px solid var(--line-strong);
}

.react-grid-item.react-grid-placeholder {
  background: var(--accent);
  opacity: 0.15;
  border-radius: 1rem;
}
```

- [ ] **Step 3: Add edit-mode UI tests**

In `frontend/src/modules/home/pages/RoomOverviewPage.test.tsx`, add these two tests inside the
existing `describe('RoomOverviewPage', ...)` block, after the existing test (keep the existing
test and its `beforeEach`/`afterEach` as-is):

```tsx
  it('shows an edit-mode toggle that switches to the draggable grid and back', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === DEVICES_PATH) return Promise.resolve(jsonResponse([]))
      return Promise.resolve(new Response('not found', { status: 404 }))
    })

    render(
      <MemoryRouter>
        <RoomOverviewPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('Pracovna')).toBeInTheDocument())
    expect(screen.queryByText('Resetovat rozložení')).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('Upravit rozložení'))

    expect(screen.getByText('Resetovat rozložení')).toBeInTheDocument()
    expect(screen.getByText('Hotovo')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Hotovo'))

    expect(screen.queryByText('Resetovat rozložení')).not.toBeInTheDocument()
    expect(screen.getByText('Upravit rozložení')).toBeInTheDocument()
  })

  it('clears the saved layout when Resetovat rozložení is clicked', async () => {
    localStorage.setItem('home-room-layout', JSON.stringify({ lg: [{ i: 'office', x: 0, y: 0, w: 1, h: 1 }] }))
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === DEVICES_PATH) return Promise.resolve(jsonResponse([]))
      return Promise.resolve(new Response('not found', { status: 404 }))
    })

    render(
      <MemoryRouter>
        <RoomOverviewPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('Pracovna')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Upravit rozložení'))
    await userEvent.click(screen.getByText('Resetovat rozložení'))

    expect(localStorage.getItem('home-room-layout')).toBeNull()
  })
```

Add the two needed imports at the top of the file — the full import block becomes:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomOverviewPage } from './RoomOverviewPage'
```

`@testing-library/user-event` is already a transitive dependency of `@testing-library/react`'s
peer set used elsewhere in the ecosystem, but this repo doesn't have it as a direct devDependency
yet — install it:

```bash
cd frontend && npm install -D @testing-library/user-event
```

- [ ] **Step 4: Run the tests to verify the two new ones fail**

Run: `cd frontend && npm test -- RoomOverviewPage.test.tsx`
Expected: FAIL — `Upravit rozložení` doesn't exist in the rendered output yet.

- [ ] **Step 5: Implement the edit-mode grid in `RoomOverviewPage.tsx`**

Replace the full contents of `frontend/src/modules/home/pages/RoomOverviewPage.tsx` with:

```tsx
import { useState } from 'react'
import { Responsive, WidthProvider, type Layouts } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { usePolling } from '@/hooks/usePolling'
import { getRoomReadings } from '@/modules/roomMap/api/roomMap'
import { Button } from '@/ui/Button'
import { IconCheck, IconPencil, IconRefreshCcw } from '@/ui/icons'
import { Loading } from '@/ui/Loading'
import { PageHeader } from '@/ui/PageHeader'
import { RoomOverviewCard } from '../components/RoomOverviewCard'
import { clearRoomLayout, loadRoomLayout, saveRoomLayout } from '../lib/roomLayoutStorage'

const REFRESH_INTERVAL_MS = 15_000
const GRID_BREAKPOINTS = { lg: 1024, md: 768, sm: 640 }
const GRID_COLS = { lg: 5, md: 4, sm: 3 }
const GRID_ROW_HEIGHT = 160

const ResponsiveGridLayout = WidthProvider(Responsive)

export function RoomOverviewPage() {
  const { data: readings, error, loading } = usePolling(getRoomReadings, REFRESH_INTERVAL_MS)
  const [editing, setEditing] = useState(false)
  const [layouts, setLayouts] = useState<Layouts | null>(() => loadRoomLayout())

  const handleLayoutChange = (_current: unknown, allLayouts: Layouts) => {
    setLayouts(allLayouts)
    saveRoomLayout(allLayouts)
  }

  const handleReset = () => {
    clearRoomLayout()
    setLayouts(null)
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-5 lg:px-8">
      <PageHeader
        title="Home"
        actions={
          // The toggle only appears at sm+ (matches the rail/bottom-bar breakpoint), so edit mode
          // is never entered on a phone. If a desktop window is later narrowed mid-session the
          // grid keeps rendering — an accepted, rare edge case, not worth a JS media-query for.
          <div className="hidden items-center gap-2 sm:flex">
            {editing && (
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <IconRefreshCcw className="size-4" />
                Resetovat rozložení
              </Button>
            )}
            <Button variant="neutral" size="sm" onClick={() => setEditing((v) => !v)}>
              {editing ? <IconCheck className="size-4" /> : <IconPencil className="size-4" />}
              {editing ? 'Hotovo' : 'Upravit rozložení'}
            </Button>
          </div>
        }
      />
      {loading && !readings && <Loading label="Waking Nexus…" />}
      {error && <p className="text-danger">Failed to load room data: {error.message}</p>}
      {readings && !editing && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {readings.map((reading) => (
            <RoomOverviewCard key={reading.room.id} reading={reading} />
          ))}
        </div>
      )}
      {readings && editing && (
        <ResponsiveGridLayout
          className="layout"
          breakpoints={GRID_BREAKPOINTS}
          cols={GRID_COLS}
          rowHeight={GRID_ROW_HEIGHT}
          layouts={layouts ?? undefined}
          isDraggable
          isResizable
          onLayoutChange={handleLayoutChange}
        >
          {readings.map((reading, index) => (
            <div
              key={reading.room.id}
              data-grid={layouts ? undefined : { x: index % 5, y: Math.floor(index / 5), w: 1, h: 1 }}
            >
              <RoomOverviewCard reading={reading} linkable={false} />
            </div>
          ))}
        </ResponsiveGridLayout>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd frontend && npm test -- RoomOverviewPage.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 7: Run the full test suite and the production build**

Run: `cd frontend && npm test && npm run build`
Expected: PASS.

- [ ] **Step 8: Manual smoke check**

Run: `cd frontend && npm run dev`, open Home at a desktop width (≥1024px so the toggle is
visible), click "Upravit rozložení", drag and resize a couple of room cards, click "Hotovo",
reload the page, and confirm the arrangement persisted. Click "Upravit rozložení" again, click
"Resetovat rozložení", and confirm it snaps back to the default order. Shrink the window below the
`sm` breakpoint and confirm the toggle disappears and the static grid renders.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/modules/home/pages/RoomOverviewPage.tsx frontend/src/modules/home/pages/RoomOverviewPage.test.tsx frontend/src/ui/icons.tsx frontend/src/index.css frontend/package.json frontend/package-lock.json
git commit -m "feat: add drag/resize edit mode to the Home room grid"
```

---

### Task 9: Full-suite verification

**Files:** None — verification only.

- [ ] **Step 1: Run the full test suite, the linter, and the production build**

Run: `cd frontend && npm test && npm run lint && npm run build`
Expected: PASS, no errors, no warnings from `oxlint`.

- [ ] **Step 2: Manual end-to-end check**

Run: `cd frontend && npm run dev`, then:
- Confirm "Temp" no longer appears in the nav rail/bottom bar.
- From Home, click a room card with data (e.g. "Pracovna") — confirm it navigates to
  `/room/office` and shows the device grid plus temperature/contact charts.
- From Home, click a room card with no data (e.g. "Ložnice") — confirm it navigates and shows the
  Czech empty-state message.
- From a room detail page, click "Home" in the back link — confirm it returns to `/`.
- Confirm `/devices` and an individual `/device/:id` still work exactly as before (device
  controls, charts, contact timeline).
- Repeat the Task 8 edit-mode check (drag, resize, reload, reset) once more end-to-end.

- [ ] **Step 3: No commit needed for this task** — it only verifies work already committed in
  Tasks 1–8.
