# Room Map — Design

## Purpose

Redesign the room map from a grid of same-sized tiles into an actual floor-plan-style map:
individually shaped and positioned rooms matching the apartment's real layout, styled visually
distinct from the rest of the dashboard (a blueprint/map look, not another card-based page). No
room labels are shown — the map communicates purely through room shape and, where a sensor
exists, a live reading. Still a prototype: layout and sensor assignment are hand-edited in a
static config file, no persistence.

## Scope

- Redesign only. No backend, database, or migration changes.
- Static room layout (position/size as percentages), no drag-and-drop editing, no admin UI.
- Shows temperature and humidity only, same as before.
- No room name labels rendered on the map, and no legend.
- A room with no assigned sensor, or whose sensor's telemetry lacks a needed field, renders as a
  plain outlined shape with no reading — it does not visually announce "no data", it simply has
  nothing to show, same as any untracked part of a real floor plan.

## Data

No new backend endpoints. Reuses, unchanged from the previous version:

- `getDevices()` (`frontend/src/modules/devices/api/devices.ts`) to resolve a device by
  `friendlyName`.
- `getLatestTelemetry(ieeeAddress)` (`frontend/src/modules/devices/api/telemetry.ts`) to read the
  latest `temperature` / `humidity` values.
- `frontend/src/modules/roomMap/api/roomMap.ts` (`getRoomReadings()`) — logic is unchanged; only
  the shape of `RoomConfig` it reads from changes (see below).

### Static room config

`frontend/src/modules/roomMap/config/rooms.ts`:

```ts
export interface RoomRect {
  /** All four values are percentages (0-100) of the floor plan container. */
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface RoomConfig {
  id: string;
  /** Not rendered on the map; used for aria-label/title only. */
  label: string;
  /** device.friendlyName of the assigned sensor, or null if none yet. */
  sensorFriendlyName: string | null;
  /** One rect per room, except non-rectangular rooms (e.g. an L-shaped hallway), which use several. */
  rects: RoomRect[];
}

export const rooms: RoomConfig[] = [
  {
    id: "bedroom",
    label: "Ložnice",
    sensorFriendlyName: null,
    rects: [{ top: 0, left: 0, width: 26.7, height: 100 }],
  },
  {
    id: "kitchen",
    label: "Kuchyně",
    sensorFriendlyName: null,
    rects: [{ top: 0, left: 26.7, width: 20, height: 37.5 }],
  },
  {
    id: "wc",
    label: "WC",
    sensorFriendlyName: null,
    rects: [{ top: 37.5, left: 30.7, width: 6, height: 37.5 }],
  },
  {
    id: "bathroom",
    label: "Koupelna",
    sensorFriendlyName: null,
    rects: [{ top: 37.5, left: 36.7, width: 10, height: 37.5 }],
  },
  {
    id: "hallway",
    label: "Chodba",
    sensorFriendlyName: null,
    // L-shaped: main strip at the bottom, plus a narrow connector up to the kitchen along WC's left side.
    rects: [
      { top: 75, left: 26.7, width: 20, height: 25 },
      { top: 37.5, left: 26.7, width: 4, height: 37.5 },
    ],
  },
  {
    id: "living-room",
    label: "Obývák",
    sensorFriendlyName: null,
    rects: [{ top: 0, left: 46.7, width: 26.7, height: 100 }],
  },
  {
    id: "office",
    label: "Pracovna",
    sensorFriendlyName: "Bedroom temp",
    rects: [{ top: 0, left: 73.4, width: 26.6, height: 100 }],
  },
];
```

This replaces the previous 6-room list (which included a placeholder `kids-room` and used a CSS
`grid-area` string per room). The `sensorFriendlyName: "Bedroom temp"` device now represents the
Pracovna room's real sensor — the device's friendly name in the registry is unrelated to the room
label it is mapped to here.

Editing the map later means editing this one file: adjusting `rects` values or adding rooms — no
migration, no API change.

## Layout

The floor plan is one `relative` container with a fixed aspect ratio (`aspect-[9/4]`,
approximating the real apartment's proportions) and no intrinsic scroll — it scales with its
container width. Each room renders one absolutely positioned box per entry in its `rects` array,
each using that entry's `top`/`left`/`width`/`height` as inline percentages. Because every wall in
the real apartment is axis-aligned, plain absolutely positioned `div`s reproduce the shapes
exactly — no SVG needed. A room is rectangular in the common case (`rects` has one entry); the
hallway is L-shaped (it wraps around WC to reach the kitchen), so its `rects` has two: the main
strip and a narrow connector.

Nesting (WC and Koupelna sitting inside the Kuchyně/Chodba column) falls out naturally from the
percentage coordinates; no parent/child DOM nesting is required, all seven rooms are siblings
positioned independently within the same container.

## Visual style

The map is visually separate from the rest of the dashboard's card-based UI — it should read as a
blueprint/floor plan, not another panel of tiles:

- Floor plan container: `bg-surface-sunken`, square corners (no `rounded-*`), no drop shadow.
- Room outlines: `border border-line-strong`, thin.
- Room with no data: outline only, no fill treatment beyond the container background, no text.
  It must not look like a distinct "empty state" box — it should simply look like an unlabeled
  room on a map.
- Room with data (currently only Pracovna): the reading (`temperature`/`humidity`) is rendered
  centered inside the room in `font-mono`, using `text-accent`, with the room's border in
  `border-accent` (or an accent glow) so it reads as "live" against the otherwise inert map.
- These are local styles scoped to the room-map module's own components — they must not reuse
  the `TemperatureCard`/dashboard card classes, so future changes to card styling elsewhere don't
  bleed into the map and vice versa.

## Components

- `frontend/src/modules/roomMap/api/roomMap.ts` — unchanged (`getRoomReadings()`), still returns
  `RoomReading[]` = `{ room: RoomConfig, temperature?: number, humidity?: number }`.
- `frontend/src/modules/roomMap/components/RoomShape.tsx` — replaces `RoomTile.tsx`. Renders one
  absolutely positioned `div` per entry in `reading.room.rects`, each with `aria-label`/`title` set
  to `reading.room.label` for accessibility (not visibly rendered). The reading text
  (`temperature`/`humidity`, when present) is rendered only inside the first rect, styled per
  "Visual style" above, so a multi-rect room doesn't show the number twice.
- `frontend/src/modules/roomMap/pages/RoomMapPage.tsx` — polls `getRoomReadings()` every 15s via
  `usePolling` (unchanged interval), renders `PageHeader` + a `relative aspect-[9/4]` floor-plan
  container that maps `readings` to `RoomShape`s. Loading/error states unchanged from before.
- `frontend/src/modules/roomMap/routes.tsx` — unchanged route (`/room-map`), nav icon switches
  from `IconLayoutGrid` (visually implies a tile grid, which this redesign moves away from) to a
  new `IconMap` in `frontend/src/ui/icons.tsx` (folded-map outline, following the existing
  24x24 stroke-icon pattern in that file).

## Error handling

Unchanged from the previous version: a failed `getLatestTelemetry` call for a room's sensor is
caught and treated as "no data" for that room, not a page-level error. A page-level error is only
shown if `getDevices()` itself fails.

## Testing

- `frontend/src/modules/roomMap/api/roomMap.test.ts` — unchanged, still covers a room with a
  resolvable sensor and full data, a room with `sensorFriendlyName: null`, a room whose
  `friendlyName` doesn't match any device, and a room whose telemetry fetch throws. Test fixtures
  are updated to use the new 7-room list where they reference specific rooms by id/label.
- `frontend/src/modules/roomMap/components/RoomShape.test.tsx` — replaces `RoomTile.test.tsx`.
  Asserts inline position styles match `reading.room.rects` (`top`/`left`/`width`/`height` as
  percentages), asserts no room label text is rendered, asserts the reading text
  (temperature/humidity) is present when data exists and absent when it doesn't, and asserts a
  multi-rect (L-shaped) room renders one box per rect with the reading only in the first.
