# Home page and device-chart redesign

Status: approved
Date: 2026-08-03

## Problem

The home page (`/`) currently shows a device grid grouped by type (Lights, Switches,
Sensors, Other). This is not the most useful glance view — the user wants room
temperature/humidity/door-state at a glance instead. Separately, the device detail
page always renders every telemetry field as a `LineChart` in API response order;
this puts diagnostic fields (`battery`, `linkquality`) ahead of the field a device
actually exists to report, and it renders binary fields (`contact`) as a dense wall
of vertical bars that conveys nothing at a glance.

## Scope

Frontend only (`frontend/`). No backend or schema changes — `contact` history is
derived client-side from the existing 0/1 telemetry points.

## 1. Home page → room overview

`DashboardPage` (`/`) is replaced by a new room overview: a grid of compact cards,
one per room from `frontend/src/modules/roomMap/config/rooms.ts`.

Each card shows, for rooms with at least one assigned sensor:
- Room label
- Temperature, if reported by an assigned sensor — `font-mono`, large, `text-warm`
- Humidity, if reported — `font-mono`, `text-cool`
- Door/contact state, if reported — small badge, `ok` ("zavřeno") or `danger`
  ("otevřeno")

Rooms with no assigned sensor render a muted card ("bez senzoru", reduced opacity),
so the grid still shows all 7 rooms.

Cards are informational only — not clickable — in this iteration. Values come from
the existing latest-readings polling (15s), matched by `friendlyName` the same way
`RoomMapPage` already does it.

## 2. Room config: one sensor → many

`RoomConfig.sensorFriendlyName: string | null` becomes
`sensorFriendlyNames: string[]`, so a room can report from more than one device
(e.g. a temperature sensor and a separate door sensor).

Real assignment for this change:
- `office`: `['Bedroom temp', 'Dveře']`
- all other rooms: `[]` (unchanged — no real sensors placed yet)

`RoomShape.tsx` (the existing floorplan page, `roomMap` module) consumes the same
config and must be updated to read from multiple sensors instead of one. Its
rendering (temperature/humidity overlay on the floorplan) stays as-is aside from
that data-shape change; a door badge there is not in scope.

## 3. Devices page

The device grid (Lights/Switches/Sensors/Other groupings) that currently lives on
`/` moves as-is to a new route `/devices`, with its own nav entry: `IconLayoutGrid`,
label "Devices". Placed in the rail immediately after Home.

## 4. Device detail chart ordering

On `DeviceDetailPage`, chart fields are sorted so diagnostic fields sort last:
`battery` and `linkquality` always render after every other field, which keeps
its incoming (API) order otherwise. `contact` is removed from the generic
chart-field list entirely — see below.

## 5. Contact (binary) field: timeline instead of line chart

`contact` gets a dedicated component instead of `TelemetryFieldChart`'s
`LineChart`:

1. **Current state badge** — "zavřeno" (`ok`) / "otevřeno" (`danger`), from the
   latest point.
2. **Segmented horizontal timeline** — one bar spanning the selected time range
   (1h/6h/24h/7d, same selector already on the page), split into colored segments
   (`ok`/`danger`) proportional to how long the sensor spent in each state.
3. **Recent transitions list** — below the timeline, the last few open/close
   events with timestamp and duration.

Segments and transitions are both derived client-side from the same 0/1 points
array the API already returns for `contact` (diff consecutive points to find
transition timestamps); no new endpoint or backend change.

## Out of scope

- Any backend/database change (no `room` table, no FK — config stays static).
- Extending binary-field handling to fields other than `contact` (none exist in
  `KNOWN_TELEMETRY_FIELDS` today).
- Making room cards clickable / linking into device detail.
- Floorplan page (`RoomMapPage`) visual redesign beyond the data-shape change
  forced by point 2.
