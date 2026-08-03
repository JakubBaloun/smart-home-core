# Home page and device-chart redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the home page's device-type grid with a room-overview grid (temperature/humidity/door state per room), move the old device grid to a new `/devices` route, reorder device-detail charts so primary telemetry precedes diagnostics, and replace the `contact` field's line chart with a state timeline.

**Architecture:** Frontend-only (`frontend/`), no backend changes. A new `home` module owns `/` and a `RoomOverviewPage`; the existing `roomMap` module's `rooms.ts` config and `getRoomReadings()` are extended (one sensor → many, plus `contact`) and reused by both the new home page and the existing floorplan page. The existing `devices` module keeps device list + detail but moves the list to `/devices`. `contact` gets a small pure-function module (`lib/contactSegments.ts`) plus a presentational `ContactTimeline` component, both unit-tested in isolation from data fetching.

**Tech Stack:** React 19, TypeScript, Vite, Vitest + Testing Library, Tailwind v4 (semantic tokens only, no raw hex), react-router-dom.

## Global Constraints

- No backend/database changes — everything derives from existing endpoints (`/api/devices`, `/api/telemetry/:key/latest`, `/api/telemetry/:key`).
- Colors: use semantic Tailwind utilities only (`text-warm`, `text-cool`, `text-ok`, `text-danger`, `bg-ok`, `bg-danger`, `border-line`, `bg-surface-raised`, `text-ink`/`text-ink-muted`/`text-ink-faint`) — never raw hex, per `frontend/DESIGN.md`.
- Numbers/telemetry/times always `font-mono` with `tabular-nums`, per existing convention (see `DeviceCard.tsx`, `RoomShape.tsx`).
- `contact` semantics: telemetry value `1` = closed (door shut), `0` = open — confirmed in `backend/src/main/java/io/smarthome/core/automation/rule/DoorOpenedLightsRule.java:48-54` (`Boolean contactClosed`).
- Every new/changed file gets or keeps a Vitest test; follow existing patterns (`vi.stubGlobal('fetch', vi.fn())` for API modules, `@testing-library/react` + `MemoryRouter` for components that route).
- Run `npm test` and `npm run build` (inside `frontend/`) before considering any task done that touches shared files (Task 2, 5, 6).

---

### Task 1: Room config — one sensor per room → many

**Files:**
- Modify: `frontend/src/modules/roomMap/config/rooms.ts`

**Interfaces:**
- Produces: `RoomConfig.sensorFriendlyNames: string[]` (replaces `sensorFriendlyName: string | null`). Consumed by Task 2 (`getRoomReadings`) and by tests in Task 2/3.

- [ ] **Step 1: Change the type and every room entry**

Replace the field on the interface (`rooms.ts:13-21`):

```ts
export interface RoomConfig {
  id: string
  /** Not rendered on the map; used for aria-label/title only. */
  label: string
  /** device.friendlyName values of assigned sensors (temperature, contact, ...), or [] if none yet. */
  sensorFriendlyNames: string[]
  /** One rect per room, except non-rectangular rooms (e.g. an L-shaped hallway), which use several. */
  rects: RoomRect[]
}
```

Replace every `sensorFriendlyName: null,` with `sensorFriendlyNames: [],` for `bedroom`, `kitchen`, `wc`, `bathroom`, `hallway`, `living-room`. Replace the `office` room's `sensorFriendlyName: 'Bedroom temp',` with:

```ts
    sensorFriendlyNames: ['Bedroom temp', 'Dveře'],
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: errors in `api/roomMap.ts` and the two test files that still reference `sensorFriendlyName` (fixed in Task 2). No errors from `rooms.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/roomMap/config/rooms.ts
git commit -m "feat(frontend): support multiple sensors per room"
```

---

### Task 2: `getRoomReadings` — merge multiple sensors, add `contact`

**Files:**
- Modify: `frontend/src/modules/roomMap/api/roomMap.ts`
- Modify: `frontend/src/modules/roomMap/api/roomMap.test.ts`
- Modify: `frontend/src/modules/roomMap/components/RoomShape.test.tsx` (fixtures only)

**Interfaces:**
- Consumes: `RoomConfig.sensorFriendlyNames: string[]` (Task 1), `getDevices(): Promise<Device[]>`, `getLatestTelemetry(ieeeAddress: string): Promise<LatestTelemetryResponse>` (both existing, unchanged).
- Produces: `RoomReading { room: RoomConfig; temperature?: number; humidity?: number; contact?: boolean }` — `contact: true` means closed. Consumed by Task 3/4 (`RoomOverviewCard`/`RoomOverviewPage`) and already-existing `RoomShape.tsx` (ignores `contact`, unaffected).

- [ ] **Step 1: Update the fixtures in the two existing test files to the new shape (still red until Step 2)**

In `frontend/src/modules/roomMap/components/RoomShape.test.tsx`, replace both fixture objects:

```ts
const room: RoomConfig = {
  id: 'office',
  label: 'Pracovna',
  sensorFriendlyNames: ['Bedroom temp'],
  rects: [{ top: 0, left: 66.6, width: 33.4, height: 100 }],
}

const lShapedRoom: RoomConfig = {
  id: 'hallway',
  label: 'Chodba',
  sensorFriendlyNames: [],
  rects: [
    { top: 75, left: 26.7, width: 20, height: 25 },
    { top: 37.5, left: 42.7, width: 4, height: 37.5 },
  ],
}
```

And the inline override in the "no data" test (`sensorFriendlyName: null` → `sensorFriendlyNames: []`):

```ts
    const reading: RoomReading = { room: { ...room, sensorFriendlyNames: [] } }
```

- [ ] **Step 2: Rewrite `roomMap.test.ts` to cover multi-sensor merge and `contact`**

Replace the whole file:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getRoomReadings } from './roomMap'

const DEVICES_PATH = '/api/devices'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

function mockFetchSequence(devices: unknown[], telemetryByKey: Record<string, unknown>) {
  vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    if (url === DEVICES_PATH) {
      return Promise.resolve(jsonResponse(devices))
    }
    const match = Object.keys(telemetryByKey).find((key) => url === `/api/telemetry/${key}/latest`)
    if (match) {
      const value = telemetryByKey[match]
      if (value === 'ERROR') {
        return Promise.resolve(new Response('boom', { status: 500 }))
      }
      return Promise.resolve(jsonResponse(value))
    }
    return Promise.resolve(new Response('not found', { status: 404 }))
  })
}

describe('getRoomReadings', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('attaches temperature and humidity for a room whose sensor resolves and reports both', async () => {
    mockFetchSequence(
      [{ id: 1, friendlyName: 'Bedroom temp', ieeeAddress: '0xaaa' }],
      { '0xaaa': { deviceName: 'Bedroom temp', values: { temperature: 21.5, humidity: 44 }, lastUpdated: '2026-07-31T10:00:00Z' } },
    )

    const readings = await getRoomReadings()
    const office = readings.find((r) => r.room.id === 'office')!

    expect(office.temperature).toBe(21.5)
    expect(office.humidity).toBe(44)
  })

  it('merges readings from a second assigned sensor in the same room', async () => {
    mockFetchSequence(
      [
        { id: 1, friendlyName: 'Bedroom temp', ieeeAddress: '0xaaa' },
        { id: 2, friendlyName: 'Dveře', ieeeAddress: '0xbbb' },
      ],
      {
        '0xaaa': { deviceName: 'Bedroom temp', values: { temperature: 21.5, humidity: 44 }, lastUpdated: '2026-07-31T10:00:00Z' },
        '0xbbb': { deviceName: 'Dveře', values: { contact: 1, battery: 100, linkquality: 60 }, lastUpdated: '2026-07-31T10:00:00Z' },
      },
    )

    const readings = await getRoomReadings()
    const office = readings.find((r) => r.room.id === 'office')!

    expect(office.temperature).toBe(21.5)
    expect(office.humidity).toBe(44)
    expect(office.contact).toBe(true)
  })

  it('maps a contact value of 0 to open (false)', async () => {
    mockFetchSequence(
      [{ id: 2, friendlyName: 'Dveře', ieeeAddress: '0xbbb' }],
      { '0xbbb': { deviceName: 'Dveře', values: { contact: 0 }, lastUpdated: '2026-07-31T10:00:00Z' } },
    )

    const readings = await getRoomReadings()
    const office = readings.find((r) => r.room.id === 'office')!

    expect(office.contact).toBe(false)
  })

  it('leaves temperature/humidity/contact undefined for a room with no assigned sensors', async () => {
    mockFetchSequence([], {})

    const readings = await getRoomReadings()
    const livingRoom = readings.find((r) => r.room.id === 'living-room')!

    expect(livingRoom.temperature).toBeUndefined()
    expect(livingRoom.humidity).toBeUndefined()
    expect(livingRoom.contact).toBeUndefined()
  })

  it('leaves fields undefined when a configured friendlyName matches no device', async () => {
    mockFetchSequence([{ id: 9, friendlyName: 'some_other_device', ieeeAddress: '0xbbb' }], {})

    const readings = await getRoomReadings()
    const office = readings.find((r) => r.room.id === 'office')!

    expect(office.temperature).toBeUndefined()
    expect(office.contact).toBeUndefined()
  })

  it('keeps data from a sensor that resolved when a sibling sensor in the same room fails', async () => {
    mockFetchSequence(
      [
        { id: 1, friendlyName: 'Bedroom temp', ieeeAddress: '0xaaa' },
        { id: 2, friendlyName: 'Dveře', ieeeAddress: '0xbbb' },
      ],
      {
        '0xaaa': { deviceName: 'Bedroom temp', values: { temperature: 21.5 }, lastUpdated: '2026-07-31T10:00:00Z' },
        '0xbbb': 'ERROR',
      },
    )

    const readings = await getRoomReadings()
    const office = readings.find((r) => r.room.id === 'office')!

    expect(office.temperature).toBe(21.5)
    expect(office.contact).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run the tests to confirm they fail against the old implementation**

Run: `cd frontend && npx vitest run src/modules/roomMap`
Expected: FAIL — `roomMap.ts` still reads `room.sensorFriendlyName` (singular) and doesn't set `contact`.

- [ ] **Step 4: Rewrite `getRoomReadings`**

Replace the whole file:

```ts
import { getDevices } from '@/modules/devices/api/devices'
import { getLatestTelemetry } from '@/modules/devices/api/telemetry'
import { rooms, type RoomConfig } from '../config/rooms'

export interface RoomReading {
  room: RoomConfig
  temperature?: number
  humidity?: number
  /** true = closed, false = open. */
  contact?: boolean
}

export async function getRoomReadings(): Promise<RoomReading[]> {
  const devices = await getDevices()

  return Promise.all(
    rooms.map(async (room): Promise<RoomReading> => {
      const reading: RoomReading = { room }

      for (const sensorFriendlyName of room.sensorFriendlyNames) {
        const device = devices.find((d) => d.friendlyName === sensorFriendlyName)
        if (!device) continue

        try {
          const latest = await getLatestTelemetry(device.ieeeAddress)
          if (typeof latest.values.temperature === 'number') reading.temperature = latest.values.temperature
          if (typeof latest.values.humidity === 'number') reading.humidity = latest.values.humidity
          if (typeof latest.values.contact === 'number') reading.contact = latest.values.contact === 1
        } catch {
          // This sensor failed to resolve — leave whatever the room already has from a sibling sensor.
        }
      }

      return reading
    }),
  )
}
```

- [ ] **Step 5: Run the tests again**

Run: `cd frontend && npx vitest run src/modules/roomMap`
Expected: PASS (all tests in both `roomMap.test.ts` and `RoomShape.test.tsx`)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/roomMap/api/roomMap.ts frontend/src/modules/roomMap/api/roomMap.test.ts frontend/src/modules/roomMap/components/RoomShape.test.tsx
git commit -m "feat(frontend): merge multi-sensor room readings, add contact"
```

---

### Task 3: `RoomOverviewCard` component

**Files:**
- Create: `frontend/src/modules/home/components/RoomOverviewCard.tsx`
- Create: `frontend/src/modules/home/components/RoomOverviewCard.test.tsx`

**Interfaces:**
- Consumes: `RoomReading` from `@/modules/roomMap/api/roomMap` (Task 2).
- Produces: `RoomOverviewCard({ reading: RoomReading }): JSX.Element`. Consumed by Task 4 (`RoomOverviewPage`).

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RoomOverviewCard } from './RoomOverviewCard'
import type { RoomReading } from '@/modules/roomMap/api/roomMap'
import type { RoomConfig } from '@/modules/roomMap/config/rooms'

function room(overrides: Partial<RoomConfig> = {}): RoomConfig {
  return {
    id: 'office',
    label: 'Pracovna',
    sensorFriendlyNames: ['Bedroom temp', 'Dveře'],
    rects: [{ top: 0, left: 0, width: 100, height: 100 }],
    ...overrides,
  }
}

describe('RoomOverviewCard', () => {
  it('shows temperature, humidity, and a closed badge when all three are reported', () => {
    const reading: RoomReading = { room: room(), temperature: 21.4, humidity: 48, contact: true }

    render(<RoomOverviewCard reading={reading} />)

    expect(screen.getByText('Pracovna')).toBeInTheDocument()
    expect(screen.getByText('21.4°')).toBeInTheDocument()
    expect(screen.getByText('48%')).toBeInTheDocument()
    expect(screen.getByText('zavřeno')).toBeInTheDocument()
  })

  it('shows an open badge when contact is false', () => {
    const reading: RoomReading = { room: room(), contact: false }

    render(<RoomOverviewCard reading={reading} />)

    expect(screen.getByText('otevřeno')).toBeInTheDocument()
  })

  it('omits humidity and the door badge when only temperature is reported', () => {
    const reading: RoomReading = { room: room(), temperature: 19.0 }

    render(<RoomOverviewCard reading={reading} />)

    expect(screen.getByText('19.0°')).toBeInTheDocument()
    expect(screen.queryByText('%')).not.toBeInTheDocument()
    expect(screen.queryByText('zavřeno')).not.toBeInTheDocument()
    expect(screen.queryByText('otevřeno')).not.toBeInTheDocument()
  })

  it('renders a muted "no sensor" state when nothing is reported', () => {
    const reading: RoomReading = { room: room({ sensorFriendlyNames: [] }) }

    render(<RoomOverviewCard reading={reading} />)

    expect(screen.getByText('Pracovna')).toBeInTheDocument()
    expect(screen.getByText('bez senzoru')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd frontend && npx vitest run src/modules/home/components/RoomOverviewCard.test.tsx`
Expected: FAIL — `./RoomOverviewCard` does not exist.

- [ ] **Step 3: Implement the component**

```tsx
import type { RoomReading } from '@/modules/roomMap/api/roomMap'

export function RoomOverviewCard({ reading }: { reading: RoomReading }) {
  const { room, temperature, humidity, contact } = reading
  const hasData = temperature !== undefined || humidity !== undefined || contact !== undefined

  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        hasData ? 'border-line bg-surface-raised' : 'border-line/60 bg-surface-raised/40'
      }`}
    >
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
    </div>
  )
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd frontend && npx vitest run src/modules/home/components/RoomOverviewCard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/home/components/RoomOverviewCard.tsx frontend/src/modules/home/components/RoomOverviewCard.test.tsx
git commit -m "feat(frontend): add RoomOverviewCard"
```

---

### Task 4: `RoomOverviewPage` + `home` module registration

**Files:**
- Create: `frontend/src/modules/home/pages/RoomOverviewPage.tsx`
- Create: `frontend/src/modules/home/pages/RoomOverviewPage.test.tsx`
- Create: `frontend/src/modules/home/routes.tsx`
- Modify: `frontend/src/app/modules.ts`

**Interfaces:**
- Consumes: `getRoomReadings()` and `RoomReading` (Task 2), `RoomOverviewCard` (Task 3), `usePolling` (`@/hooks/usePolling`, existing), `PageHeader`/`Loading` (`@/ui`, existing), `IconHome` (`@/ui/icons`, existing), `ModuleManifest` (`@/app/modules`, existing).
- Produces: `homeModule: ModuleManifest` with `nav.to === '/'`. Consumed by Task 5 (`modules.ts` ordering).

- [ ] **Step 1: Write the failing page test**

```tsx
import { render, screen, waitFor } from '@testing-library/react'
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

    render(<RoomOverviewPage />)

    await waitFor(() => expect(screen.getByText('Pracovna')).toBeInTheDocument())
    expect(screen.getByText('Ložnice')).toBeInTheDocument()
    expect(screen.getByText('Kuchyně')).toBeInTheDocument()
    expect(screen.getAllByText('bez senzoru').length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd frontend && npx vitest run src/modules/home/pages/RoomOverviewPage.test.tsx`
Expected: FAIL — `./RoomOverviewPage` does not exist.

- [ ] **Step 3: Implement the page**

```tsx
import { usePolling } from '@/hooks/usePolling'
import { getRoomReadings } from '@/modules/roomMap/api/roomMap'
import { Loading } from '@/ui/Loading'
import { PageHeader } from '@/ui/PageHeader'
import { RoomOverviewCard } from '../components/RoomOverviewCard'

const REFRESH_INTERVAL_MS = 15_000

export function RoomOverviewPage() {
  const { data: readings, error, loading } = usePolling(getRoomReadings, REFRESH_INTERVAL_MS)

  return (
    <div className="h-full overflow-y-auto px-6 py-5 lg:px-8">
      <PageHeader title="Home" />
      {loading && !readings && <Loading label="Waking Nexus…" />}
      {error && <p className="text-danger">Failed to load room data: {error.message}</p>}
      {readings && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {readings.map((reading) => (
            <RoomOverviewCard key={reading.room.id} reading={reading} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd frontend && npx vitest run src/modules/home/pages/RoomOverviewPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Create the module manifest**

```tsx
import type { ModuleManifest } from '@/app/modules'
import { IconHome } from '@/ui/icons'
import { RoomOverviewPage } from './pages/RoomOverviewPage'

export const homeModule: ModuleManifest = {
  nav: {
    to: '/',
    label: 'Home',
    railLabel: 'Home',
    icon: IconHome,
    isActive: (pathname) => pathname === '/',
  },
  routes: [{ path: '/', element: <RoomOverviewPage /> }],
}
```

- [ ] **Step 6: Register it in `modules.ts` — add the import and put it first in rail order**

In `frontend/src/app/modules.ts`, add `import { homeModule } from '@/modules/home/routes'` alongside the other module imports (alphabetically, before `recipesModule`), and change `shellModules` to:

```ts
export const shellModules: ModuleManifest[] = [
  homeModule,
  devicesModule,
  temperatureModule,
  roomMapModule,
  recipesModule,
  shoppingModule,
  todoModule,
  calendarModule,
]
```

(`devicesModule`'s own `nav.to` still resolves to `/` at this point — Task 5 changes it to `/devices`. Until Task 5 lands, two rail entries point at `/`; that's fine mid-plan since each task must build and test cleanly, but don't stop here — continue straight to Task 5.)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/modules/home frontend/src/app/modules.ts
git commit -m "feat(frontend): add room-overview home page"
```

---

### Task 5: Move the device grid to `/devices`

**Files:**
- Modify (rename): `frontend/src/modules/devices/pages/DashboardPage.tsx` → `frontend/src/modules/devices/pages/DevicesPage.tsx`
- Modify: `frontend/src/modules/devices/routes.tsx`

**Interfaces:**
- Consumes: `IconLayoutGrid` (`@/ui/icons`, existing, currently unused elsewhere).
- Produces: `devicesModule.nav.to === '/devices'`. `DeviceDetailPage`'s links to `/devices` (Task 6) depend on this route existing.

- [ ] **Step 1: Rename the file and its exported component**

```bash
git mv frontend/src/modules/devices/pages/DashboardPage.tsx frontend/src/modules/devices/pages/DevicesPage.tsx
```

In `DevicesPage.tsx`, rename `export function DashboardPage()` to `export function DevicesPage()`. No other change — the device-grid body stays exactly as it is (online count, `DeviceGrid`).

- [ ] **Step 2: Update `routes.tsx`**

Replace the whole file:

```tsx
import type { ModuleManifest } from '@/app/modules'
import { IconLayoutGrid } from '@/ui/icons'
import { DeviceDetailPage } from './pages/DeviceDetailPage'
import { DevicesPage } from './pages/DevicesPage'

export const devicesModule: ModuleManifest = {
  nav: {
    to: '/devices',
    label: 'Devices',
    railLabel: 'Devices',
    icon: IconLayoutGrid,
    isActive: (pathname) => pathname.startsWith('/devices') || pathname.startsWith('/device/'),
  },
  routes: [
    { path: '/devices', element: <DevicesPage /> },
    { path: '/device/:id', element: <DeviceDetailPage /> },
  ],
}
```

- [ ] **Step 3: Type-check and run the full frontend suite**

Run: `cd frontend && npx tsc --noEmit && npm test`
Expected: no type errors; all tests pass (no test file imports `DashboardPage` — confirmed during planning).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/devices/pages/DevicesPage.tsx frontend/src/modules/devices/routes.tsx
git commit -m "feat(frontend): move device grid to /devices"
```

---

### Task 6: Point `DeviceDetailPage` back-link and post-delete redirect at `/devices`

**Files:**
- Modify: `frontend/src/modules/devices/pages/DeviceDetailPage.tsx:98`
- Modify: `frontend/src/modules/devices/pages/DeviceDetailPage.tsx:121`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new (behavioral fix only).

- [ ] **Step 1: Fix the post-delete redirect**

At `DeviceDetailPage.tsx:98`, change:

```ts
      navigate('/')
```

to:

```ts
      navigate('/devices')
```

- [ ] **Step 2: Fix the back link**

At `DeviceDetailPage.tsx:121`, change:

```tsx
        back={{ to: '/', label: 'Devices' }}
```

to:

```tsx
        back={{ to: '/devices', label: 'Devices' }}
```

- [ ] **Step 3: Run the frontend suite**

Run: `cd frontend && npm test`
Expected: PASS (no existing test asserts on these two literals — confirmed during planning; this is a behavioral fix with no dedicated regression test since it's two hardcoded route strings, not exercised by `DeviceDetailPage`'s current tests).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/devices/pages/DeviceDetailPage.tsx
git commit -m "fix(frontend): point device detail back-link and delete redirect at /devices"
```

---

### Task 7: Chart-order sorting (`battery`/`linkquality` last)

**Files:**
- Create: `frontend/src/modules/devices/lib/fieldOrder.ts`
- Create: `frontend/src/modules/devices/lib/fieldOrder.test.ts`

**Interfaces:**
- Produces: `sortFieldsForDisplay(fields: string[]): string[]`. Consumed by Task 11 (`DeviceDetailPage`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { sortFieldsForDisplay } from './fieldOrder'

describe('sortFieldsForDisplay', () => {
  it('leaves non-diagnostic fields in their original order', () => {
    expect(sortFieldsForDisplay(['humidity', 'temperature', 'power'])).toEqual([
      'humidity',
      'temperature',
      'power',
    ])
  })

  it('moves battery and linkquality to the end, in their original relative order', () => {
    expect(sortFieldsForDisplay(['linkquality', 'temperature', 'battery', 'humidity'])).toEqual([
      'temperature',
      'humidity',
      'linkquality',
      'battery',
    ])
  })

  it('handles a list of only diagnostic fields', () => {
    expect(sortFieldsForDisplay(['battery', 'linkquality'])).toEqual(['battery', 'linkquality'])
  })

  it('handles an empty list', () => {
    expect(sortFieldsForDisplay([])).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd frontend && npx vitest run src/modules/devices/lib/fieldOrder.test.ts`
Expected: FAIL — `./fieldOrder` does not exist.

- [ ] **Step 3: Implement**

```ts
const DIAGNOSTIC_FIELDS = new Set(['battery', 'linkquality'])

/** Sorts telemetry fields so battery/linkquality trail everything else, preserving relative order otherwise. */
export function sortFieldsForDisplay(fields: string[]): string[] {
  return [...fields].sort((a, b) => {
    const aDiagnostic = DIAGNOSTIC_FIELDS.has(a) ? 1 : 0
    const bDiagnostic = DIAGNOSTIC_FIELDS.has(b) ? 1 : 0
    return aDiagnostic - bDiagnostic
  })
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd frontend && npx vitest run src/modules/devices/lib/fieldOrder.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/devices/lib/fieldOrder.ts frontend/src/modules/devices/lib/fieldOrder.test.ts
git commit -m "feat(frontend): add diagnostic-fields-last chart sorting"
```

---

### Task 8: Export `getRangeBounds` from the telemetry API client

**Files:**
- Modify: `frontend/src/modules/devices/api/telemetry.ts`

**Interfaces:**
- Produces: `getRangeBounds(range: TimeRange, now?: Date): { from: Date; to: Date }`. Consumed by Task 11 (`ContactTimelineCard`).
- Consumes: existing `RANGE_TO_DURATION_MS`, `TimeRange`.

- [ ] **Step 1: Refactor to extract and export the bounds calculation**

Replace the top of `telemetry.ts` (through the start of `getTelemetryHistory`'s body) with:

```ts
import { apiFetch } from '@/api/client'
import type { LatestTelemetryResponse, TelemetryResponse, TimeRange } from '../types/telemetry'

const RANGE_TO_DURATION_MS: Record<TimeRange, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
}

export function getRangeBounds(range: TimeRange, now: Date = new Date()): { from: Date; to: Date } {
  return { from: new Date(now.getTime() - RANGE_TO_DURATION_MS[range]), to: now }
}

/**
 * `deviceKey` should be the device's `ieeeAddress`. It is immutable, so charts
 * survive a rename; the backend maps it to the device's whole history,
 * including points recorded under names it used to have. A friendly name still
 * works, but only for as long as that name is current.
 */
export function getTelemetryHistory(
  deviceKey: string,
  field: string,
  range: TimeRange,
): Promise<TelemetryResponse> {
  const { from, to } = getRangeBounds(range)

  const params = new URLSearchParams({
    field,
    from: from.toISOString(),
    to: to.toISOString(),
  })

  return apiFetch<TelemetryResponse>(`/telemetry/${encodeURIComponent(deviceKey)}?${params}`)
}
```

Leave `getLatestTelemetry` untouched below it.

- [ ] **Step 2: Run the existing telemetry API tests to confirm the refactor is behavior-preserving**

Run: `cd frontend && npx vitest run src/modules/devices/api/telemetry.test.ts`
Expected: PASS (no test file change needed — `getTelemetryHistory`'s external behavior is unchanged)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/devices/api/telemetry.ts
git commit -m "refactor(frontend): extract and export getRangeBounds from telemetry client"
```

---

### Task 9: `contactSegments` pure logic (segments + duration formatting)

**Files:**
- Create: `frontend/src/modules/devices/lib/contactSegments.ts`
- Create: `frontend/src/modules/devices/lib/contactSegments.test.ts`

**Interfaces:**
- Consumes: `TelemetryPoint` (`../types/telemetry`, existing).
- Produces: `ContactSegment { closed: boolean; startMs: number; endMs: number }`, `buildContactSegments(points: TelemetryPoint[], fromMs: number, toMs: number): ContactSegment[]`, `formatDuration(ms: number): string`. Consumed by Task 10 (`ContactTimeline`).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { buildContactSegments, formatDuration } from './contactSegments'
import type { TelemetryPoint } from '../types/telemetry'

const FROM = new Date('2026-08-01T00:00:00Z').getTime()
const TO = new Date('2026-08-01T01:00:00Z').getTime()

function point(iso: string, value: number): TelemetryPoint {
  return { time: iso, value }
}

describe('buildContactSegments', () => {
  it('returns no segments when there are no points', () => {
    expect(buildContactSegments([], FROM, TO)).toEqual([])
  })

  it('returns a single segment spanning the whole range when the state never changes', () => {
    const points = [point('2026-08-01T00:10:00Z', 1), point('2026-08-01T00:40:00Z', 1)]

    expect(buildContactSegments(points, FROM, TO)).toEqual([{ closed: true, startMs: FROM, endMs: TO }])
  })

  it('splits into segments at each observed state change', () => {
    const points = [point('2026-08-01T00:20:00Z', 1), point('2026-08-01T00:40:00Z', 0)]
    const t1 = new Date('2026-08-01T00:40:00Z').getTime()

    expect(buildContactSegments(points, FROM, TO)).toEqual([
      { closed: true, startMs: FROM, endMs: t1 },
      { closed: false, startMs: t1, endMs: TO },
    ])
  })

  it('handles multiple oscillations and covers the full range with no gaps', () => {
    const points = [
      point('2026-08-01T00:10:00Z', 0),
      point('2026-08-01T00:12:00Z', 1),
      point('2026-08-01T00:30:00Z', 0),
      point('2026-08-01T00:31:00Z', 1),
    ]

    const segments = buildContactSegments(points, FROM, TO)

    expect(segments).toHaveLength(4)
    expect(segments[0].startMs).toBe(FROM)
    expect(segments[segments.length - 1].endMs).toBe(TO)
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].startMs).toBe(segments[i - 1].endMs)
    }
  })

  it('treats any non-1 value as open', () => {
    const points = [point('2026-08-01T00:10:00Z', 0)]

    expect(buildContactSegments(points, FROM, TO)).toEqual([{ closed: false, startMs: FROM, endMs: TO }])
  })
})

describe('formatDuration', () => {
  it('formats sub-minute durations in seconds', () => {
    expect(formatDuration(40_000)).toBe('40 s')
  })

  it('formats sub-hour durations in minutes', () => {
    expect(formatDuration(2 * 60_000)).toBe('2 min')
  })

  it('formats hour-plus durations as hours and minutes', () => {
    expect(formatDuration(3 * 60 * 60_000 + 10 * 60_000)).toBe('3 h 10 min')
  })

  it('omits minutes when they round to zero', () => {
    expect(formatDuration(2 * 60 * 60_000)).toBe('2 h')
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `cd frontend && npx vitest run src/modules/devices/lib/contactSegments.test.ts`
Expected: FAIL — `./contactSegments` does not exist.

- [ ] **Step 3: Implement**

```ts
import type { TelemetryPoint } from '../types/telemetry'

export interface ContactSegment {
  /** true = closed, false = open. */
  closed: boolean
  startMs: number
  endMs: number
}

function isClosed(value: number): boolean {
  return value === 1
}

/**
 * Builds contiguous closed/open segments spanning [fromMs, toMs]. The state
 * before the first observed point is assumed to equal that point's value —
 * there is no earlier data to know otherwise.
 */
export function buildContactSegments(points: TelemetryPoint[], fromMs: number, toMs: number): ContactSegment[] {
  if (points.length === 0) return []

  const sorted = [...points].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
  const segments: ContactSegment[] = []
  let currentState = isClosed(sorted[0].value)
  let segmentStart = fromMs

  for (const p of sorted) {
    const t = new Date(p.time).getTime()
    const state = isClosed(p.value)
    if (t <= segmentStart) {
      currentState = state
      continue
    }
    if (state !== currentState) {
      segments.push({ closed: currentState, startMs: segmentStart, endMs: t })
      segmentStart = t
      currentState = state
    }
  }

  segments.push({ closed: currentState, startMs: segmentStart, endMs: toMs })
  return segments
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds} s`

  const totalMinutes = Math.round(totalSeconds / 60)
  if (totalMinutes < 60) return `${totalMinutes} min`

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `cd frontend && npx vitest run src/modules/devices/lib/contactSegments.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/devices/lib/contactSegments.ts frontend/src/modules/devices/lib/contactSegments.test.ts
git commit -m "feat(frontend): add contact-segment derivation and duration formatting"
```

---

### Task 10: `ContactTimeline` presentational component

**Files:**
- Create: `frontend/src/modules/devices/components/ContactTimeline.tsx`
- Create: `frontend/src/modules/devices/components/ContactTimeline.test.tsx`

**Interfaces:**
- Consumes: `buildContactSegments`, `formatDuration` (Task 9); `TelemetryPoint` (existing type).
- Produces: `ContactTimeline({ points: TelemetryPoint[]; fromMs: number; toMs: number; currentValue?: number }): JSX.Element`. Consumed by Task 11 (`ContactTimelineCard`).

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ContactTimeline } from './ContactTimeline'
import type { TelemetryPoint } from '../types/telemetry'

const FROM = new Date('2026-08-01T00:00:00Z').getTime()
const TO = new Date('2026-08-01T01:00:00Z').getTime()

describe('ContactTimeline', () => {
  it('shows a closed badge and no transitions when the state never changes', () => {
    const points: TelemetryPoint[] = [{ time: '2026-08-01T00:10:00Z', value: 1 }]

    render(<ContactTimeline points={points} fromMs={FROM} toMs={TO} currentValue={1} />)

    expect(screen.getByText('zavřeno')).toBeInTheDocument()
    expect(screen.getByText('Beze změny v tomto rozsahu')).toBeInTheDocument()
  })

  it('shows an open badge when currentValue is 0', () => {
    const points: TelemetryPoint[] = [{ time: '2026-08-01T00:10:00Z', value: 0 }]

    render(<ContactTimeline points={points} fromMs={FROM} toMs={TO} currentValue={0} />)

    expect(screen.getByText('otevřeno')).toBeInTheDocument()
  })

  it('lists recent transitions with a duration when the state changes', () => {
    const points: TelemetryPoint[] = [
      { time: '2026-08-01T00:10:00Z', value: 1 },
      { time: '2026-08-01T00:29:00Z', value: 0 },
      { time: '2026-08-01T00:31:00Z', value: 1 },
    ]

    render(<ContactTimeline points={points} fromMs={FROM} toMs={TO} currentValue={1} />)

    expect(screen.getByText(/otevřeno \(2 min\)/)).toBeInTheDocument()
  })

  it('falls back to the last point when currentValue is not given', () => {
    const points: TelemetryPoint[] = [
      { time: '2026-08-01T00:10:00Z', value: 1 },
      { time: '2026-08-01T00:20:00Z', value: 0 },
    ]

    render(<ContactTimeline points={points} fromMs={FROM} toMs={TO} />)

    expect(screen.getByText('otevřeno')).toBeInTheDocument()
  })

  it('shows a no-data message when there are no points and no currentValue', () => {
    render(<ContactTimeline points={[]} fromMs={FROM} toMs={TO} />)

    expect(screen.getByText('No data for "contact" in this range.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd frontend && npx vitest run src/modules/devices/components/ContactTimeline.test.tsx`
Expected: FAIL — `./ContactTimeline` does not exist.

- [ ] **Step 3: Implement**

```tsx
import { buildContactSegments, formatDuration } from '../lib/contactSegments'
import type { TelemetryPoint } from '../types/telemetry'

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ContactTimeline({
  points,
  fromMs,
  toMs,
  currentValue,
}: {
  points: TelemetryPoint[]
  fromMs: number
  toMs: number
  currentValue?: number
}) {
  const segments = buildContactSegments(points, fromMs, toMs)

  const closed =
    currentValue !== undefined
      ? currentValue === 1
      : points.length > 0
        ? segments[segments.length - 1].closed
        : undefined

  if (closed === undefined) {
    return <p className="text-sm text-ink-muted">No data for "contact" in this range.</p>
  }

  const recentTransitions = segments.length > 1 ? [...segments.slice(1)].reverse().slice(0, 5) : []

  return (
    <div>
      <span
        className={`inline-block rounded-full border px-3 py-1 text-sm ${
          closed ? 'border-ok/40 bg-ok/10 text-ok' : 'border-danger/40 bg-danger/10 text-danger'
        }`}
      >
        {closed ? 'zavřeno' : 'otevřeno'}
      </span>

      {segments.length > 0 && (
        <div className="mt-4 flex h-7 overflow-hidden rounded-md">
          {segments.map((segment, i) => (
            <div
              key={i}
              className={segment.closed ? 'bg-ok' : 'bg-danger'}
              style={{ width: `${((segment.endMs - segment.startMs) / (toMs - fromMs)) * 100}%` }}
            />
          ))}
        </div>
      )}

      <div className="mt-3 font-mono text-xs text-ink-muted">
        {recentTransitions.length > 0 ? (
          recentTransitions.map((segment, i) => (
            <div key={i}>
              {formatTime(segment.startMs)}–{formatTime(segment.endMs)}{' '}
              {segment.closed ? 'zavřeno' : 'otevřeno'} ({formatDuration(segment.endMs - segment.startMs)})
            </div>
          ))
        ) : (
          <p>Beze změny v tomto rozsahu</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd frontend && npx vitest run src/modules/devices/components/ContactTimeline.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/devices/components/ContactTimeline.tsx frontend/src/modules/devices/components/ContactTimeline.test.tsx
git commit -m "feat(frontend): add ContactTimeline component"
```

---

### Task 11: Wire chart ordering and `ContactTimeline` into `DeviceDetailPage`

**Files:**
- Modify: `frontend/src/modules/devices/pages/DeviceDetailPage.tsx`

**Interfaces:**
- Consumes: `sortFieldsForDisplay` (Task 7), `getRangeBounds` (Task 8), `ContactTimeline` (Task 10), `getTelemetryHistory`/`getLatestTelemetry` (existing).
- Produces: nothing new — this is the integration point; no other task depends on it.

- [ ] **Step 1: Update imports**

At the top of `DeviceDetailPage.tsx`, change:

```ts
import { getLatestTelemetry, getTelemetryHistory } from '../api/telemetry'
import { TelemetryChart } from '../components/TelemetryChart'
```

to:

```ts
import { getLatestTelemetry, getRangeBounds, getTelemetryHistory } from '../api/telemetry'
import { ContactTimeline } from '../components/ContactTimeline'
import { TelemetryChart } from '../components/TelemetryChart'
import { sortFieldsForDisplay } from '../lib/fieldOrder'
```

- [ ] **Step 2: Split and sort fields**

Replace line 44 (`const fields = latest ? Object.keys(latest.values) : []`) with:

```ts
  const allFields = latest ? Object.keys(latest.values) : []
  const hasContact = allFields.includes('contact')
  const chartFields = sortFieldsForDisplay(allFields.filter((f) => f !== 'contact'))
```

- [ ] **Step 3: Update the render guard and chart section**

Replace:

```tsx
      {fields.length > 0 && (
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

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {fields.map((field) => (
              <TelemetryFieldChart key={field} deviceKey={device.ieeeAddress} field={field} range={range} />
            ))}
          </div>
        </div>
      )}
```

with:

```tsx
      {(hasContact || chartFields.length > 0) && (
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

          {hasContact && (
            <div className="mb-6">
              <ContactTimelineCard
                deviceKey={device.ieeeAddress}
                range={range}
                currentValue={latest?.values.contact}
              />
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
      )}
```

- [ ] **Step 4: Add the `ContactTimelineCard` wrapper next to `TelemetryFieldChart`**

At the bottom of the file, after the existing `TelemetryFieldChart` function, add:

```tsx
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

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Manual smoke test against dev infra**

```bash
docker compose -f docker-compose.dev.yaml up -d
cd backend-python && python -m app.main &
cd frontend && npm run dev
```

Open `http://localhost:5173`, navigate to a sensor device with `contact` in its telemetry (or, if none exists locally, temporarily publish one: `docker exec mqtt-broker-dev mosquitto_pub -t zigbee2mqtt/test_contact -m '{"contact":true,"battery":90,"linkquality":50}'` after registering it via `zigbee2mqtt/bridge/devices`, or simply verify visually that non-contact sensors — e.g. `smoke_thermo` — render fields with `battery`/`linkquality` last). Confirm:
- Chart order: primary field(s) first, `battery`/`linkquality` last.
- A device with `contact` shows the badge + timeline + transitions instead of a line chart.
- Time range buttons (1h/6h/24h/7d) still work and reload the timeline.

Stop background processes afterward.

- [ ] **Step 7: Run the full frontend suite**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add frontend/src/modules/devices/pages/DeviceDetailPage.tsx
git commit -m "feat(frontend): reorder detail charts and use ContactTimeline for contact"
```

---

### Task 12: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `cd frontend && npm test`
Expected: PASS, all suites including the ones touched in Tasks 1–11.

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Production build**

Run: `cd frontend && npm run build`
Expected: builds cleanly, no warnings about unused `sensorFriendlyName` or missing routes.

- [ ] **Step 4: Manual click-through**

With the dev stack running (per Task 11 Step 6), visit `/` (room overview — Pracovna shows data if `Bedroom temp`/`Dveře` exist in the connected environment, other rooms show "bez senzoru"), `/devices` (device grid, unchanged look), and the rail: confirm "Home" and "Devices" are both present as separate icons and both highlight correctly for their respective routes.

- [ ] **Step 5: Report**

Summarize what changed and confirm all verification steps passed. No commit for this task — it's verification only.
