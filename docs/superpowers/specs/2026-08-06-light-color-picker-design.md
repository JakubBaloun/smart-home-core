# Light RGB Color Picker — Design

## Goal

Today `LightControls.tsx` only exposes brightness and color temperature (mireds/Kelvin) — there
is no hue/saturation support anywhere in the stack (DB, Quarkus spec, command service, MQTT
consumer, frontend types). Add full RGB color control for Zigbee2MQTT devices that support it
(starting with one RGB bulb, generalizing to RGB LED strips), via a hand-rolled circular
hue/saturation picker, alongside the existing color-temp slider behind a "Bílá/Barva" toggle.

## Non-goals

- xy (CIE 1931) color space — hue+saturation only, matches Z2M's `{"color":{"hue","saturation"}}`
  convention used by the target devices.
- A color-picker library dependency — hand-rolled to match the existing hand-rolled slider
  precedent (native `<input type="range">` + custom CSS in `LightControls.tsx`/`index.css`) and
  avoid a new dependency for a ~200-line component.
- Sending raw exposes JSON to the frontend — the backend derives a `supportsColor` boolean (and
  any range info needed) from the stored `exposes` JSONB; the wire contract stays flat fields.

## 1. Capability detection — backend

Z2M's retained `zigbee2mqtt/bridge/devices` payload includes an `exposes` array per device,
listing supported features (`color_temp` range, `color_hs`/`color_xy`, `brightness`, etc.). This
is currently discarded entirely — `z2m_mapper.py` only reads `definition.description` for type
inference.

- **Migration** `backend/src/main/resources/db/migration/V1.9.0__Add_Device_Exposes_Column.sql`:
  ```sql
  ALTER TABLE device ADD COLUMN exposes JSONB;
  ```
  Nullable — non-Z2M-discovered or pre-migration devices have none. Re-snapshot
  `backend-python/schema.sql` after adding.
- **`backend-python/app/device/models.py`**: add
  `exposes: Mapped[dict | None] = mapped_column(JSONB)` (first JSONB use in this codebase — import
  `from sqlalchemy.dialects.postgresql import JSONB`), alongside the existing `brightness`/
  `color_temp` `SmallInteger` columns at L36-37. Also add:
  `hue: Mapped[int | None] = mapped_column(SmallInteger)` (0-360) and
  `saturation: Mapped[int | None] = mapped_column(SmallInteger)` (0-100).
- **`backend-python/app/device/schemas.py`** (`Z2MDevicePayload`, currently L60-68): add
  `exposes: list[dict] | None = None` to capture the raw array from the bridge payload.
- **`backend-python/app/device/z2m_mapper.py`**: `to_entity`/`update_entity_from_payload`
  (L37-56) persist `payload.exposes` verbatim into the new column — no filtering/parsing at
  ingest time, keeps the mapper simple and defers interpretation to read time.
- **Deriving `supportsColor`**: a small helper (e.g. `device/capabilities.py`, or a function
  alongside the existing mappers) walks the stored `exposes` JSON looking for a `color_hs` (or
  nested `features` entry named `color_hs`) property — Z2M's `exposes` schema nests color
  sub-features under a `light` expose's `features` array. Called from the schema conversion layer
  (wherever `DeviceResponse` is built) to compute `supportsColor: bool`, not stored redundantly.

## 2. API contract

**`backend-python/app/device/schemas.py`** `DeviceResponse` gains:

- `hue: int | None`
- `saturation: int | None`
- `colorMode: str | None` (`"color_temp"` or `"hs"`, last value reported by the device — see §4)
- `supportsColor: bool` (derived, always present — `False` rather than `None` for devices with no
  color expose)

No raw `exposes` field on the wire — it stays a backend-only column.

## 3. Command — backend

**`backend-python/app/device/command_service.py`**, alongside `set_brightness`/`set_color_temp`
(L16-19):

```python
def set_color(self, friendly_name: str, hue: int, saturation: int) -> None:
    self._publish(friendly_name, {"color": {"hue": hue, "saturation": saturation}})
```

(matching whatever internal publish helper `set_color_temp` uses — follow its exact pattern, not
`send_raw_command`, so this gets the same logging/error handling as the other typed commands).

**`schemas.py`** `DeviceCommandRequest.command` is a plain `str` today (L40-49, not an enum) — no
type change needed, just document `'setColor'` as a valid value alongside `setState`/
`setBrightness`/`setColorTemp`/`raw`.

**`router.py`** `_route_command` (L92-109): add a `setColor` branch — validate `payload` has both
`hue` (0-360) and `saturation` (0-100) keys, matching the existing per-command validation style,
then call `device_command_service.set_color(...)`.

## 4. MQTT read-back

**`backend-python/app/mqtt/consumers.py`** `consume_telemetry()` (`brightness`/`color_temp`
handling at L76-84, via `device_service.update_light_state`): extend to also read
`parsed.get("color", {}).get("hue")`, `.get("saturation")`, and `parsed.get("color_mode")` when
present, passing them into the same `update_light_state` DB write path (extend that method's
signature) so `hue`/`saturation`/`color_mode` columns stay in sync with the bulb's actual reported
state — same non-InfluxDB DB-only treatment as `brightness`/`color_temp` today (no color history
tracking, only current value).

## 5. Frontend

**`frontend/src/modules/devices/types/device.ts`**: `Device` gains `hue?: number`,
`saturation?: number`, `colorMode?: string`, `supportsColor?: boolean`.
`DeviceCommandRequest['command']` union gains `'setColor'`.

**`LightControls.tsx`**: when `device.supportsColor`, render a segmented toggle ("Bílá" / "Barva")
above the existing color-temp slider row. Default tab follows `device.colorMode` (`"hs"` → Barva,
else Bílá) on mount, but switching tabs is pure UI state — no command sent until the user
interacts with a control. "Bílá" tab = today's brightness + color-temp sliders, unchanged.
"Barva" tab = brightness slider (shared) + new `ColorWheel`.

**New `frontend/src/modules/devices/components/ColorWheel.tsx`**, hand-rolled, following the
drag-local-state pattern already established by the brightness/color-temp sliders in
`LightControls.tsx` (local state during drag, `draggingRef` to suppress the 15s poll from
clobbering an in-flight gesture, commit on pointer/touch-up):

- A circular `<div>` (or `<svg>`) sized ~200×200px: `background: conic-gradient(from 0deg, hsl(0
  100% 50%), hsl(60 100% 50%), ..., hsl(360 100% 50%))` for hue around the ring, overlaid with a
  `radial-gradient(circle, white, transparent 70%)` layer for saturation falloff toward center
  (center = fully desaturated/white, edge = fully saturated).
- Pointer/touch handlers compute the position relative to the circle's center: `angle =
  atan2(dy, dx)` normalized to 0-360 for `hue`; `distance / radius` clamped to `[0,1]` and scaled
  to `0-100` for `saturation`. Clamp the draggable thumb to stay within the circle radius even if
  the pointer moves outside it.
- Thumb: a small circle positioned via the same polar-to-cartesian math, styled with
  `var(--surface)` border/shadow per DESIGN.md token conventions (the gradient itself needs
  literal HSL values — there's no token for an arbitrary hue).
- Commits via `sendCommand(device.id, { command: 'setColor', payload: { hue, saturation } })` on
  release, mirroring the existing sliders' commit timing exactly.

## Testing

- Backend: migration + model round-trip; `z2m_mapper` persists `exposes` verbatim; capability
  helper correctly derives `supportsColor` from representative Z2M `exposes` fixtures (RGB bulb
  and LED strip payloads, plus a color-temp-only bulb fixture that must derive `False`);
  `command_service.set_color` publishes the right topic/payload; `consume_telemetry` writes
  `hue`/`saturation`/`color_mode` to Postgres from a Z2M state message; `DeviceResponse` includes
  the new fields.
- Frontend Vitest: `ColorWheel` pointer-to-hue/saturation math (including edge clamping outside
  the circle), toggle tab default from `colorMode` and no-command-on-switch, `LightControls`
  conditional rendering when `supportsColor` is false (today's two-slider layout unchanged, no
  toggle shown).
