# Room Detail Page Redesign — Design

## Goal

Replace the current masonry widget stack on the room detail page
(`frontend/src/modules/home/components/RoomTelemetryWidgets.tsx`) with a fixed layout: a row of
compact per-device stat cards, followed by always-visible full-width history sections (charts for
numeric fields, segmented timelines for boolean fields). This supersedes and replaces
`docs/superpowers/plans/2026-08-05-room-detail-widgets-and-state.md` — that plan's drag/resize
`react-grid-layout` widget grid is dropped; several of its other items (diagnostic field
filtering, `TelemetryChart` X-axis fix, collapsible `DeviceGrid`, the `device.state` DB column)
are already shipped and untouched by this redesign.

## Non-goals

- Drag/resize or per-user layout customization — the new layout is fixed, not user-arranged.
- Changing `DeviceGrid` (the collapsible device list/control section at the top of the page) —
  stays exactly as-is.
- A light color/brightness history chart — only on/off state gets a timeline, matching the door
  contact pattern. Brightness/color history is out of scope.

## 1. Time range

`RoomDetailPage.tsx:13` — `TIME_RANGES` gains `'30d'`: `['1h', '6h', '24h', '7d', '30d']`. The
`TimeRange` type (`devices/types/telemetry`) and every `range` consumer (`TelemetryChart`,
`TelemetryFieldChart`, `ContactTimeline`/`ContactTimelineCard`, the InfluxDB query window mapping
in `telemetry/service.py` if it enumerates ranges rather than parsing a duration string — verify
during implementation) must accept the new value. Button group styling updates to match the
mockup (rounded pill/chip, not the current style) — visual only, no new component.

## 2. Stat card row

New component, replacing `RoomTelemetryWidgets`'s masonry grid: a horizontal flex/wrap row (no
masonry, no `ResizeObserver` sizing — `MasonryItem` is deleted) of compact cards. **One card per
device instance**, not per room-aggregate field — a room with two temperature sensors renders two
temperature cards.

Per device type, the card shows:

- **Temperature**: current value, delta over the selected range (`+0.6° za hodinu` style —
  compute from the first and last point in the already-fetched range data), small inline
  sparkline (`Recharts` `LineChart` with no axes/grid, reuse the polling/data-fetch path
  `TemperatureCard` already has today).
- **Humidity**: current value, a trend word (`stabilní`/`stoupá`/`klesá`, threshold-based on the
  same delta calculation as temperature), sparkline.
- **Contact**: state chip (`Zavřeno`/`Otevřeno`, reuse existing `bg-ok`/`bg-danger` token
  mapping), `naposledy otevřeno HH:MM` from the most recent transition (`buildContactSegments`
  already computes transitions — reuse, don't reimplement).
- **Light**: state chip (`Zapnuto`/`Vypnuto`), brightness `%` shown only when on
  (`Math.round(brightness / 254 * 100)`, same conversion `LightControls.tsx` already uses).

Cards are visual-only (no controls) — turning a light on/off or adjusting brightness stays in
`DeviceGrid`/`LightControls` above.

## 3. Full-width history sections

Below the stat row, one section per device **that has history to show** (temperature, humidity,
contact, light — not switch/plug, which have no timeline per the non-goals). Order: temperature
sensors, then humidity sensors, then contact sensors, then lights — each section stacked full
width, always mounted (no "Zobrazit historii" toggle; `TemperatureCard`/`HumidityCard`'s
`historyOpen` local state is deleted along with the masonry cards).

- Temperature/humidity: existing `TelemetryFieldChart` unchanged, just always-rendered instead of
  toggle-gated.
- Contact: existing `ContactTimeline/ContactTimelineCard` unchanged.
- Light: new `StateTimeline`/`StateTimelineCard`, built by generalizing `ContactTimeline`/
  `ContactTimelineCard` rather than forking:
  - `contactSegments.ts`'s `isClosed(value) => value === 1` becomes a generic predicate parameter
    (or the function takes a `trueValue`/mapping, e.g. `buildStateSegments(points, fromMs, toMs,
    { isActive: (v) => v === 1 })`), and `ContactSegment.closed` is renamed to a neutral
    `active: boolean`.
  - `ContactTimeline`/`ContactTimelineCard` gain props for the two label strings (e.g.
    `activeLabel`/`inactiveLabel`) and the two color tokens (e.g. `activeColorClass`/
    `inactiveColorClass`), defaulting to today's `'zavřeno'/bg-ok` and `'otevřeno'/bg-danger` so
    the door usage is a no-op change. Light usage passes `activeLabel="zapnuto"`,
    `inactiveLabel="vypnuto"`, and an accent/neutral color pair (not danger/ok semantics — light
    being on isn't a safety state) — e.g. `bg-accent`/`bg-surface-sunken`.
  - The "no data" message and `ContactTimelineCard`'s hardcoded `field: 'contact'` become a
    `field` prop; light usage passes `field="state"`.

## 4. Backend: persist `state` history to InfluxDB

Light on/off currently updates only the Postgres `device.state` column
(`mqtt/consumers.py` L69-74, via `device_service.update_light_state`) — never reaches InfluxDB, so
there's no history to build a timeline from.

- `backend-python/app/telemetry/fields.py` `KNOWN_FIELDS`: add `"state"`.
- `backend-python/app/mqtt/consumers.py` `consume_telemetry()`: `state` must also flow into the
  `fields` dict that becomes the InfluxDB write, coerced to boolean (`"ON"` → `True`, `"OFF"` →
  `False`) before `normalize_fields()` sees it — `normalize_fields()` rejects non-numeric/
  non-boolean values, so the raw `"ON"`/`"OFF"` string must not reach it unconverted. Keep the
  existing Postgres write (L69-74) as-is; this is an additional write path, not a replacement,
  same relationship `contact` already has (contact writes to both Postgres availability-adjacent
  state and InfluxDB — verify current contact handling as the precedent during implementation).
  Apply only to `LIGHT`/`SWITCH`/`PLUG` device types — sensors don't have a `state` field.

## Testing

- Backend: `test_mqtt_consumers.py` — a `state` key in a light/switch payload writes a boolean
  field to InfluxDB (assert via the fake/test telemetry client), in addition to the existing
  Postgres write. `test_telemetry_fields.py` (or equivalent) if `KNOWN_FIELDS` has direct
  coverage.
- Frontend Vitest: stat card row renders one card per device instance (multi-sensor room case),
  delta/trend calculation, `buildStateSegments`/generalized `contactSegments.ts` predicate
  parameterization, `StateTimeline` renders correct labels/colors for light vs. the unchanged
  `ContactTimeline` snapshot for door, `TimeRange` `'30d'` plumbed through button group → chart
  query.
- Delete: `RoomTelemetryWidgets.test.tsx` (or equivalent) masonry-specific tests, replaced by
  tests for the new stat-row + history-sections component(s).

## Cleanup

Delete `docs/superpowers/plans/2026-08-05-room-detail-widgets-and-state.md` and
`docs/superpowers/specs/2026-08-05-room-detail-widgets-and-state-design.md` — superseded by this
spec. `MasonryItem` and the masonry grid CSS in `RoomTelemetryWidgets.tsx` are deleted, not kept
behind a flag.
