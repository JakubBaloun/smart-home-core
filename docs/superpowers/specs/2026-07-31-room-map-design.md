# Room Map — Design

## Purpose

Add a floor-plan-style dashboard page ("room map") that shows temperature and humidity
per room. This is a prototype: the apartment layout and room-to-sensor mapping are not
final and will be adjusted by hand once more sensors exist. No persistence is required —
the room list and sensor assignment live in a static frontend config file.

## Scope

- New frontend module only. No backend, database, or migration changes.
- Static room layout, no drag-and-drop editing, no admin UI for configuring rooms.
- Shows temperature and humidity only (per the current ask); other telemetry fields are
  out of scope.
- A room with no assigned sensor, or whose sensor's telemetry lacks a needed field,
  renders in a visually dimmed state instead of a value.

## Data

No new backend endpoints. Reuses:

- `getDevices()` (`frontend/src/modules/devices/api/devices.ts`) to resolve a device by
  `friendlyName`.
- `getLatestTelemetry(ieeeAddress)` (`frontend/src/modules/devices/api/telemetry.ts`) to
  read the latest `temperature` / `humidity` values.

### Static room config

`frontend/src/modules/roomMap/config/rooms.ts`:

```ts
export interface RoomConfig {
  id: string
  label: string
  /** device.friendlyName of the assigned sensor, or null if none yet. */
  sensorFriendlyName: string | null
  /** CSS grid-area name used by the floor plan layout. */
  area: string
}

export const rooms: RoomConfig[] = [
  { id: 'living-room', label: 'Obývák', sensorFriendlyName: null, area: 'living' },
  { id: 'kitchen', label: 'Kuchyně', sensorFriendlyName: null, area: 'kitchen' },
  { id: 'bedroom', label: 'Ložnice', sensorFriendlyName: 'smoke_thermo', area: 'bedroom' },
  { id: 'kids-room', label: 'Dětský pokoj', sensorFriendlyName: null, area: 'kids' },
  { id: 'bathroom', label: 'Koupelna', sensorFriendlyName: null, area: 'bathroom' },
  { id: 'hallway', label: 'Chodba', sensorFriendlyName: null, area: 'hallway' },
]
```

Editing the map later (real apartment layout, more sensors) means editing this one file —
no migration, no API change.

## Layout

CSS grid with `grid-template-areas` approximating an apartment shape (not to scale, no
exact geometry):

```
"living  living  kitchen"
"living  living  kitchen"
"hallway hallway kids"
"bedroom bathroom kids"
```

Living room is the largest tile; hallway sits centrally; bedroom/bathroom/kids are
smaller tiles. This is a placeholder arrangement — swapping in the real layout later is a
matter of editing the `grid-template-areas` string and each room's `area` value.

## Components

- `frontend/src/modules/roomMap/api/roomMap.ts` — `getRoomReadings()`: for each
  `RoomConfig`, if `sensorFriendlyName` is set, find the matching `Device` via
  `getDevices()`, fetch `getLatestTelemetry(device.ieeeAddress)`, and pull out
  `temperature` / `humidity` (each optional — a sensor may report only one). Returns
  `RoomReading[]` = `{ room: RoomConfig, temperature?: number, humidity?: number }`.
  A room with no sensor, an unresolvable `friendlyName`, or a failed telemetry fetch
  simply gets no `temperature`/`humidity` — same dimmed rendering, no special-casing.
- `frontend/src/modules/roomMap/components/RoomTile.tsx` — renders one grid cell: room
  label always shown; temperature/humidity shown in the mono numeric style used
  elsewhere (`TemperatureCard`) when present, otherwise the tile is dimmed (muted
  background/text, no numbers).
- `frontend/src/modules/roomMap/pages/RoomMapPage.tsx` — polls `getRoomReadings()` every
  15s via the existing `usePolling` hook (same interval as `TemperaturePage`), renders
  `PageHeader` + the CSS grid of `RoomTile`s. Loading/error states follow the
  `TemperaturePage` pattern.
- `frontend/src/modules/roomMap/routes.tsx` — `ModuleManifest` for route `/room-map`,
  registered in `frontend/src/app/modules.ts` alongside the other modules.
- New nav icon in `frontend/src/ui/icons.tsx` (`IconLayoutGrid` or similar) — no existing
  icon fits a floor-plan/room-map concept.

## Error handling

Matches the existing `getTemperatureReadings` pattern: a failed `getLatestTelemetry` call
for a room's sensor is caught and treated as "no data" for that room, not a page-level
error. A page-level error is only shown if `getDevices()` itself fails.

## Testing

`frontend/src/modules/roomMap/api/roomMap.test.ts` (Vitest), mirroring
`devices/api/telemetry.test.ts`: covers a room with a resolvable sensor and full data, a
room with `sensorFriendlyName: null`, a room whose `friendlyName` doesn't match any
device, and a room whose telemetry fetch throws.
