# Room Detail Page, Temperature Module Removal, Dynamic Home Layout — Design

**Goal:** Remove the standalone Temperature page. Make each room card on the Home page a link
into a new per-room detail page showing every sensor chart and every registered device for that
room. On tablet/desktop, let the user freely drag/resize the Home room cards into a custom layout
that persists locally.

**Scope:** Frontend only (`frontend/`). No backend/database changes — the room concept remains a
frontend-only config, as it is today in `modules/roomMap/config/rooms.ts`.

## 1. Data model: generalize room → device mapping

`frontend/src/modules/roomMap/config/rooms.ts`:

- Rename `RoomConfig.sensorIeeeAddresses: string[]` → `RoomConfig.deviceIeeeAddresses: string[]`.
  Same shape (array of `device.ieeeAddress`), but now holds every device assigned to the room —
  sensors, lights, switches, plugs — not just sensors.
- `office` room: `['0xe456acfffe5dc028', '0x54dce9fffefa56fb', '0xa4c138518ed616e3']`.
- All other rooms keep `[]` (unchanged from today — real assignments are filled in later directly
  in this file).
- `frontend/src/modules/roomMap/api/roomMap.ts` (`getRoomReadings`): loop over
  `room.deviceIeeeAddresses` instead of `room.sensorIeeeAddresses`. Behavior is otherwise
  unchanged — it still just probes `getLatestTelemetry` per device id and picks out
  `temperature`/`humidity`/`contact` if present; non-sensor devices simply won't have those keys.

## 2. Home page: room cards become links

`frontend/src/modules/home/components/RoomOverviewCard.tsx`:

- Wrap the existing card body in a `react-router-dom` `Link` to `/room/{room.id}`, with a hover
  affordance matching `DeviceCard` (`hover:-translate-y-0.5 hover:border-line-strong
  hover:shadow-lg active:scale-[0.98]`).
- Cards with no data remain clickable — the target page shows its own empty state.
- When the Home page is in edit mode (section 5), the card is rendered without the `Link` wrapper
  (plain `div`) so dragging doesn't fight with navigation.

## 3. New route: Room Detail page

New page `frontend/src/modules/home/pages/RoomDetailPage.tsx`, registered in
`frontend/src/modules/home/routes.tsx` as `{ path: '/room/:id', element: <RoomDetailPage /> }`.

- Resolves `id` against `rooms` from `roomMap/config/rooms.ts`; unknown id → same not-found
  handling style as `DeviceDetailPage` uses for a missing device (loading/error paths), rendered
  inline since this is a static config lookup, not an API call.
- `PageHeader` with `back={{ to: '/', label: 'Home' }}`, title = `room.label`.
- Empty state: if `room.deviceIeeeAddresses.length === 0`, render `"V tomto pokoji nejsou
  zaregistrovaná žádná zařízení."` and stop.
- **Device grid section:** fetch `getDeviceReadings()` (existing, from
  `modules/devices/api/deviceReadings.ts`), filter to devices whose `ieeeAddress` is in
  `room.deviceIeeeAddresses`, render with the existing `DeviceGrid` component unchanged (keeps its
  type-based sections and links through to `/device/:id` for control).
- **Telemetry section:** one shared time-range picker (`TimeRange`, same `1h/6h/24h/7d` set as
  `DeviceDetailPage`) for the whole room page. For every device in the room that has telemetry
  data (i.e. appears in `getLatestTelemetry` with a non-empty `values`), render its fields using
  the same building blocks `DeviceDetailPage` uses today — see section 4. Devices are labeled by
  `friendlyName` above their chart group so multiple sensors in one room stay distinguishable.

## 4. Extract shared telemetry chart components

`DeviceDetailPage.tsx` currently defines `TelemetryFieldChart` and `ContactTimelineCard` as
private, file-local components. `RoomDetailPage` needs the same per-field chart-with-range-picker
behavior for potentially several devices, so duplicating them is the wrong move.

- Move both out, unchanged, into:
  - `frontend/src/modules/devices/components/TelemetryFieldChart.tsx`
  - `frontend/src/modules/devices/components/ContactTimelineCard.tsx`
- `DeviceDetailPage.tsx` imports them instead of defining them; its rendering behavior is
  unchanged.
- `RoomDetailPage.tsx` imports them too, calling one instance per `(device, field)` pair (and one
  `ContactTimelineCard` per device that has a `contact` field), passing `deviceKey =
  device.ieeeAddress` and the page's shared `range`.

## 5. Dynamic Home layout (tablet/desktop only)

Below the `sm` breakpoint (matching the existing rail/bottom-bar breakpoint in `AppShell.tsx`),
Home is unchanged: today's static `grid grid-cols-2 gap-4 sm:grid-cols-3 ...` of `RoomOverviewCard`
links.

At `sm` and above, `RoomOverviewPage` gains an edit mode:

- **Library:** `react-grid-layout` (`ResponsiveGridLayout` + `WidthProvider`). Peer dep is
  `react >= 16.3.0`, compatible with React 19 already in use.
- **Toggle:** a header action (icon button, `hidden sm:inline-flex`) "Upravit rozložení" /
  "Hotovo" flips local `editing` state.
  - `editing = false` (default): render the existing static Tailwind grid of `Link`-wrapped
    `RoomOverviewCard`s — no `react-grid-layout` in the tree at all, zero overhead on the common
    path.
  - `editing = true`: render `ResponsiveGridLayout` with one grid item per room
    (`i = room.id`), `RoomOverviewCard` rendered without its `Link` (plain, non-navigating), drag
    handle = whole card, resizable + draggable enabled. Breakpoints/cols approximate the current
    Tailwind grid: `{ lg: 5, md: 4, sm: 3 }`.
- **Persistence:** on `onLayoutChange`, write the layout (`{i, x, y, w, h}[]`) to `localStorage`
  under key `home-room-layout`. On mount, if that key exists, pass it as the grid's initial
  `layouts`; otherwise let `react-grid-layout` auto-place items in room order (today's order).
  Autosave — no separate "Save" action needed beyond leaving edit mode.
- **Reset:** a small "Resetovat rozložení" action (visible only while `editing = true`) clears the
  `home-room-layout` key and re-mounts the grid with the default auto-placed layout.

## Testing

- `RoomOverviewCard.test.tsx`: update for the `Link` wrapper (target href), keep existing
  data-rendering assertions.
- `roomMap.test.ts`: rename `sensorIeeeAddresses` → `deviceIeeeAddresses` in fixtures (mechanical,
  same cases as today).
- New `RoomDetailPage.test.tsx`: empty-room state, device grid rendering scoped to room, chart
  section presence for a room with a sensor device.
- Delete `modules/temperature/` entirely — no tests exist there today (confirmed).
- New tests for extracted `TelemetryFieldChart`/`ContactTimelineCard` are optional — their
  behavior is unchanged from what `DeviceDetailPage.test.tsx` (if any) already exercises; no new
  coverage is required solely for the extraction.
- Home edit-mode/drag persistence: cover the `localStorage` read/write contract with a focused
  test (mock `localStorage`, assert `onLayoutChange` payload is persisted and reloaded), rather
  than trying to simulate real pointer drag/resize gestures through `react-grid-layout`.

## Out of scope

- No backend room field/migration (per user decision — frontend config only).
- No cross-device/shared layout sync (localStorage only, per device/browser).
- Edit mode / drag-resize is not available below the `sm` breakpoint (phone keeps the static grid).
