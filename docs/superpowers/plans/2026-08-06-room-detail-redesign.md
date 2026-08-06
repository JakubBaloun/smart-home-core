# Room Detail Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the room detail page's masonry widget stack with a fixed layout — a row of compact per-device stat cards followed by always-visible full-width history sections (charts for numeric fields, segmented timelines for boolean fields) — and delete the superseded `2026-08-05-room-detail-widgets-and-state` plan/spec.

**Architecture:** Backend gains a `state` (on/off) InfluxDB telemetry write path alongside the existing Postgres write. Frontend generalizes the door-specific `ContactTimeline`/`contactSegments` into a reusable state-timeline primitive, reused for both door contact and light on/off. New `RoomStatCards` and `RoomHistorySections` components replace `RoomTelemetryWidgets`'s masonry grid.

**Tech Stack:** Python 3.12 / FastAPI / SQLAlchemy 2.0 / paho-mqtt / InfluxDB (backend-python/); React 19 + TypeScript + Vite + Recharts (frontend/); pytest + testcontainers (backend tests, DB never mocked); Vitest + Testing Library (frontend tests).

## Global Constraints

- Telemetry fields are always written to InfluxDB as double or boolean, never mixed int/float per field — `state` must be coerced to boolean before the existing `normalize_fields()` coercion, matching `telemetry/service.py`'s existing invariant.
- `bool` must be checked before the numeric branch anywhere state coercion happens (Python `isinstance(True, int)` is `True`).
- Datetimes use the annotated types in `common/datetimes.py`, never bare `datetime`.
- Backend tests never mock the database — testcontainers or `TEST_DB_URL`.
- No drag/resize layout customization — this redesign is a fixed layout, not user-arranged (explicit non-goal in the spec).
- `DeviceGrid` (collapsible device list/control section) is unchanged by this plan.

---

I have enough context now. Now producing the plan.

### Task 1: Add `state` to backend `KNOWN_FIELDS`

**Files:**
- Modify: `/Users/jakub/smart-home-core/backend-python/app/telemetry/fields.py:4-19`
- Test: `/Users/jakub/smart-home-core/backend-python/tests/test_mqtt_consumers.py`

**Interfaces:**
- Consumes: nothing (leaf change)
- Produces: `KNOWN_FIELDS` frozenset now contains `"state"`; `KNOWN_FIELDS_ORDERED` tuple ends with `"state"`.

- [ ] **Step 1: Write the failing test**

Add to `/Users/jakub/smart-home-core/backend-python/tests/test_mqtt_consumers.py` (new test near `test_consume_telemetry_all_known_fields`):

```python
def test_known_fields_includes_state():
    from app.telemetry.fields import KNOWN_FIELDS, KNOWN_FIELDS_ORDERED

    assert "state" in KNOWN_FIELDS
    assert "state" in KNOWN_FIELDS_ORDERED
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jakub/smart-home-core/backend-python && pytest tests/test_mqtt_consumers.py::test_known_fields_includes_state -x`

Expected: FAIL with `AssertionError: assert 'state' in frozenset({...})`.

- [ ] **Step 3: Write minimal implementation**

Replace file `/Users/jakub/smart-home-core/backend-python/app/telemetry/fields.py`:

```python
"""KNOWN_FIELDS lives on TelemetryConsumer in Quarkus; it is kept in the telemetry
package here so the REST layer does not have to import the MQTT layer."""

KNOWN_FIELDS: frozenset[str] = frozenset(
    {"temperature", "humidity", "battery", "power", "voltage", "energy", "linkquality", "contact", "state"}
)

# Java's Set.of has an unspecified (per-JVM randomized) iteration order, so the
# order inside the 400 message is not stable there either. Fixed here.
KNOWN_FIELDS_ORDERED: tuple[str, ...] = (
    "temperature",
    "humidity",
    "battery",
    "power",
    "voltage",
    "energy",
    "linkquality",
    "contact",
    "state",
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jakub/smart-home-core/backend-python && pytest tests/test_mqtt_consumers.py::test_known_fields_includes_state -x`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend-python/app/telemetry/fields.py backend-python/tests/test_mqtt_consumers.py
git commit -m "$(cat <<'EOF'
feat(backend): add "state" to KNOWN_FIELDS for InfluxDB history

Prerequisite for writing light on/off transitions to InfluxDB so the
room detail page can render a state timeline mirroring the contact one.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Persist light/switch/plug `state` to InfluxDB as boolean

**Files:**
- Modify: `/Users/jakub/smart-home-core/backend-python/app/mqtt/consumers.py:45-102`
- Test: `/Users/jakub/smart-home-core/backend-python/tests/test_mqtt_consumers.py`

**Interfaces:**
- Consumes: `KNOWN_FIELDS` from Task 1 (must include `"state"`).
- Produces: For a `LIGHT`/`SWITCH`/`PLUG` device whose payload contains `state: "ON"|"OFF"`, `telemetry_service.write_telemetry` is called with `fields["state"] = True|False` (boolean). Postgres update is unchanged. Sensors and unresolved devices do not get a `state` InfluxDB field.

- [ ] **Step 1: Write the failing test**

Update the existing `test_consume_telemetry_writes_state_to_postgres_not_influx` and `test_consume_telemetry_state_only_payload_updates_device_without_influx_write` in `/Users/jakub/smart-home-core/backend-python/tests/test_mqtt_consumers.py` (these were asserting the *old* behaviour), and add new tests. Replace those two tests and add three:

```python
def test_consume_telemetry_writes_light_state_to_influx_as_boolean(written):
    with transaction() as session:
        device_repository.save(
            Device(
                ieee_address="00:11:22:33:44:55:66:88",
                friendly_name="living_room",
                type=DeviceType.LIGHT.value,
                available=True,
            ),
            session,
        )

    consumers.consume_telemetry(
        "zigbee2mqtt/living_room",
        _encode({"temperature": 22.5, "state": "ON"}),
    )

    assert written == [
        ("00:11:22:33:44:55:66:88", "sensor_data", {"temperature": 22.5, "state": True}),
    ]

    with read_session() as session:
        device = device_repository.find_by_ieee_address("00:11:22:33:44:55:66:88", session)
    assert device.state == "ON"


def test_consume_telemetry_switch_state_only_payload_writes_boolean_influx(written):
    with transaction() as session:
        device_repository.save(
            Device(
                ieee_address="00:11:22:33:44:55:66:99",
                friendly_name="hallway_switch",
                type=DeviceType.SWITCH.value,
                available=True,
            ),
            session,
        )

    consumers.consume_telemetry("zigbee2mqtt/hallway_switch", _encode({"state": "OFF"}))

    assert written == [("00:11:22:33:44:55:66:99", "sensor_data", {"state": False})]

    with read_session() as session:
        device = device_repository.find_by_ieee_address("00:11:22:33:44:55:66:99", session)
    assert device.state == "OFF"


def test_consume_telemetry_sensor_state_string_is_not_written_to_influx(written):
    with transaction() as session:
        device_repository.save(
            Device(
                ieee_address="00:11:22:33:44:55:66:EE",
                friendly_name="motion_sensor",
                type=DeviceType.SENSOR.value,
                available=True,
            ),
            session,
        )

    consumers.consume_telemetry(
        "zigbee2mqtt/motion_sensor",
        _encode({"temperature": 21.0, "state": "ON"}),
    )

    assert written == [("00:11:22:33:44:55:66:EE", "sensor_data", {"temperature": 21.0})]


def test_consume_telemetry_state_for_unknown_device_does_not_write_state_field(written):
    consumers.consume_telemetry("zigbee2mqtt/ghost", _encode({"state": "ON"}))
    assert written == []


def test_consume_telemetry_state_unknown_string_value_is_not_written_to_influx(written):
    with transaction() as session:
        device_repository.save(
            Device(
                ieee_address="00:11:22:33:44:55:66:F0",
                friendly_name="odd_light",
                type=DeviceType.LIGHT.value,
                available=True,
            ),
            session,
        )

    consumers.consume_telemetry("zigbee2mqtt/odd_light", _encode({"state": "TOGGLE"}))

    assert written == []
```

Then delete the old `test_consume_telemetry_writes_state_to_postgres_not_influx` and `test_consume_telemetry_state_only_payload_updates_device_without_influx_write` and `test_consume_telemetry_state_for_unknown_device_does_not_raise` from the same file — they encode the pre-change behaviour and are superseded by the tests above.

Also update `test_consume_telemetry_mixed_payload_filters_unknown_fields` to no longer assume `state` is filtered — change its payload to something that still hits an unresolved sensor path with no state field:

```python
def test_consume_telemetry_mixed_payload_filters_unknown_fields(written):
    consumers.consume_telemetry(
        "zigbee2mqtt/living_room",
        _encode({"temperature": 22.5, "update_available": False}),
    )
    assert written == [("living_room", "sensor_data", {"temperature": 22.5})]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jakub/smart-home-core/backend-python && pytest tests/test_mqtt_consumers.py -x`

Expected: FAIL — the new `test_consume_telemetry_writes_light_state_to_influx_as_boolean` fails with `AssertionError` because `state` is not in the written fields dict (raw `"ON"` string was filtered by `normalize_fields`).

- [ ] **Step 3: Write minimal implementation**

Edit `/Users/jakub/smart-home-core/backend-python/app/mqtt/consumers.py`. Add a helper below `_as_optional_int` (around line 43) and modify `consume_telemetry` (lines 45-102). Replace lines 69-96 with:

```python
    state = parsed.get("state")
    if isinstance(state, str) and identity is not None:
        try:
            device_service.update_state(identity.ieee_address, state)
        except Exception as e:
            log.error("Failed to update state for %s: %s", device_name, e)

    brightness = _as_optional_int(parsed.get("brightness"))
    color_temp = _as_optional_int(parsed.get("color_temp"))
    if identity is not None and (brightness is not None or color_temp is not None):
        try:
            device_service.update_light_state(
                identity.ieee_address, brightness=brightness, color_temp=color_temp
            )
        except Exception as e:
            log.error("Failed to update light state for %s: %s", device_name, e)

    # Convert "ON"/"OFF" to a boolean the telemetry pipeline will keep as-is.
    # normalize_fields() rejects non-numeric/non-boolean values, so the raw
    # string would otherwise be silently dropped. Only actuator types have
    # meaningful on/off state; a sensor's "state" (e.g. motion "occupied")
    # is a different concept and stays out of InfluxDB.
    fields_source: dict[str, Any] = dict(parsed)
    if identity is not None and identity.type in _STATE_HISTORY_TYPES:
        boolean_state = _state_to_bool(state)
        if boolean_state is not None:
            fields_source["state"] = boolean_state
        else:
            fields_source.pop("state", None)
    else:
        fields_source.pop("state", None)

    fields = {k: v for k, v in fields_source.items() if k in KNOWN_FIELDS}
    if not fields:
        log.debug("No known telemetry fields in message from %s, skipping", device_name)
        return
    # Rules are configured by device name, so the event keeps carrying a name —
    # the registry's, which is the one the user sees and configures against.
    rule_name = identity.friendly_name if identity else device_name

    try:
        telemetry_service.write_telemetry(tag, "sensor_data", fields)
    except Exception as e:
        log.error("Failed to write telemetry from %s (payload: %s): %s", device_name, body, e)
        return
```

And add near the top of the file (after `_unregistered_names`):

```python
_STATE_HISTORY_TYPES: frozenset[str] = frozenset({"LIGHT", "SWITCH", "PLUG"})


def _state_to_bool(value: Any) -> bool | None:
    if value == "ON":
        return True
    if value == "OFF":
        return False
    return None
```

Also add `from app.device.models import DeviceType` is NOT needed — we compare against string literals since `Device.type` is stored as a plain string in the ORM. (Verify: `Device.type` column stores `.value` of `DeviceType` — see `device/models.py`; string comparison matches what `identity.type` returns.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jakub/smart-home-core/backend-python && pytest tests/test_mqtt_consumers.py -x`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend-python/app/mqtt/consumers.py backend-python/tests/test_mqtt_consumers.py
git commit -m "$(cat <<'EOF'
feat(backend): write light/switch/plug state to InfluxDB as boolean

"ON"/"OFF" is coerced to true/false before normalize_fields() sees it,
so on/off transitions become queryable history for the new room-detail
state timeline. Postgres state column is still updated as before.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Add `'30d'` to `TimeRange` type and duration map

**Files:**
- Modify: `/Users/jakub/smart-home-core/frontend/src/modules/devices/types/telemetry.ts:31`
- Modify: `/Users/jakub/smart-home-core/frontend/src/modules/devices/api/telemetry.ts:4-9`
- Modify: `/Users/jakub/smart-home-core/frontend/src/modules/devices/lib/chartTime.ts:7`
- Test: `/Users/jakub/smart-home-core/frontend/src/modules/devices/lib/chartTime.test.ts` and a new test in `/Users/jakub/smart-home-core/frontend/src/modules/devices/api/telemetry.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `TimeRange = '1h' | '6h' | '24h' | '7d' | '30d'`. `getRangeBounds('30d')` returns a 30-day window. `formatChartTime` uses date+time format for ranges longer than 24h (`'7d'` and `'30d'`).

- [ ] **Step 1: Write the failing test**

Add to `/Users/jakub/smart-home-core/frontend/src/modules/devices/lib/chartTime.test.ts` (check file first — I'll assume its existing structure mirrors `contactSegments.test.ts`):

```typescript
import { describe, expect, it } from 'vitest'
import { formatChartTime } from './chartTime'

describe('formatChartTime for 30d', () => {
  it('uses day.month + HH:MM for a 30d range, same as 7d', () => {
    const iso = '2026-08-01T14:05:00Z'
    expect(formatChartTime(iso, '30d')).toBe(formatChartTime(iso, '7d'))
  })
})
```

Add to `/Users/jakub/smart-home-core/frontend/src/modules/devices/api/telemetry.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { getRangeBounds } from './telemetry'

describe('getRangeBounds 30d', () => {
  it('returns a 30-day window ending at now', () => {
    const now = new Date('2026-08-06T00:00:00Z')
    const { from, to } = getRangeBounds('30d', now)
    expect(to.getTime() - from.getTime()).toBe(30 * 24 * 60 * 60 * 1000)
    expect(to.getTime()).toBe(now.getTime())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- src/modules/devices/lib/chartTime.test.ts src/modules/devices/api/telemetry.test.ts --run`

Expected: FAIL — TypeScript rejects `'30d'` as it is not assignable to `TimeRange`.

- [ ] **Step 3: Write minimal implementation**

Edit `/Users/jakub/smart-home-core/frontend/src/modules/devices/types/telemetry.ts` line 31:

```typescript
export type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d'
```

Edit `/Users/jakub/smart-home-core/frontend/src/modules/devices/api/telemetry.ts` lines 4-9:

```typescript
const RANGE_TO_DURATION_MS: Record<TimeRange, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}
```

Edit `/Users/jakub/smart-home-core/frontend/src/modules/devices/lib/chartTime.ts` line 7:

```typescript
  if (range !== '7d' && range !== '30d') return `${hh}:${mm}`
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- src/modules/devices/lib/chartTime.test.ts src/modules/devices/api/telemetry.test.ts --run`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/devices/types/telemetry.ts frontend/src/modules/devices/api/telemetry.ts frontend/src/modules/devices/lib/chartTime.ts frontend/src/modules/devices/lib/chartTime.test.ts frontend/src/modules/devices/api/telemetry.test.ts
git commit -m "$(cat <<'EOF'
feat(frontend): add 30d time range to TimeRange union

Extends duration map and chart X-axis formatter to cover 30d; backend
already accepts arbitrary from/to windows so no server change needed.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Add `30d` button to both range pickers

**Files:**
- Modify: `/Users/jakub/smart-home-core/frontend/src/modules/home/pages/RoomDetailPage.tsx:13`
- Modify: `/Users/jakub/smart-home-core/frontend/src/modules/devices/pages/DeviceDetailPage.tsx:18`
- Test: `/Users/jakub/smart-home-core/frontend/src/modules/home/pages/RoomDetailPage.test.tsx`

**Interfaces:**
- Consumes: `TimeRange` from Task 3.
- Produces: `TIME_RANGES` arrays include `'30d'` on both pages; user can click the button and it updates the range state.

- [ ] **Step 1: Write the failing test**

Add to `/Users/jakub/smart-home-core/frontend/src/modules/home/pages/RoomDetailPage.test.tsx` (inside the existing `describe`):

```typescript
it('renders a 30d button in the range picker', async () => {
  vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    if (url === DEVICES_PATH) {
      return Promise.resolve(
        jsonResponse([
          device({ id: 1, ieeeAddress: '0xe456acfffe5dc028', friendlyName: 'Office temp', type: 'SENSOR' }),
        ]),
      )
    }
    if (url === '/api/telemetry/0xe456acfffe5dc028/latest') {
      return Promise.resolve(
        jsonResponse({ deviceName: 'Office temp', values: { temperature: 21.5 }, lastUpdated: '2026-08-05T10:00:00Z' }),
      )
    }
    return Promise.resolve(new Response('not found', { status: 404 }))
  })

  renderRoom('office')

  expect(await screen.findByRole('button', { name: '30d' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- src/modules/home/pages/RoomDetailPage.test.tsx --run`

Expected: FAIL — no button with name `30d`.

- [ ] **Step 3: Write minimal implementation**

Edit `/Users/jakub/smart-home-core/frontend/src/modules/home/pages/RoomDetailPage.tsx` line 13:

```typescript
const TIME_RANGES: TimeRange[] = ['1h', '6h', '24h', '7d', '30d']
```

Edit `/Users/jakub/smart-home-core/frontend/src/modules/devices/pages/DeviceDetailPage.tsx` line 18:

```typescript
const TIME_RANGES: TimeRange[] = ['1h', '6h', '24h', '7d', '30d']
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- src/modules/home/pages/RoomDetailPage.test.tsx --run`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/home/pages/RoomDetailPage.tsx frontend/src/modules/devices/pages/DeviceDetailPage.tsx frontend/src/modules/home/pages/RoomDetailPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): expose 30d option in room and device range pickers

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Generalize `contactSegments` to `buildStateSegments`

**Files:**
- Modify: `/Users/jakub/smart-home-core/frontend/src/modules/devices/lib/contactSegments.ts`
- Test: `/Users/jakub/smart-home-core/frontend/src/modules/devices/lib/contactSegments.test.ts`

**Interfaces:**
- Consumes: `TelemetryPoint` from `../types/telemetry` (unchanged).
- Produces:
  - New `interface StateSegment { active: boolean; startMs: number; endMs: number }`.
  - New `buildStateSegments(points: TelemetryPoint[], fromMs: number, toMs: number, options: { isActive: (value: number) => boolean }): StateSegment[]`.
  - Existing `buildContactSegments(points, fromMs, toMs): ContactSegment[]` re-implemented on top of `buildStateSegments` with `isActive: (v) => v === 1`, keeping `ContactSegment.closed` for backwards compatibility so `ContactTimeline` continues to work until Task 6.
  - `formatDuration` unchanged.

- [ ] **Step 1: Write the failing test**

Append to `/Users/jakub/smart-home-core/frontend/src/modules/devices/lib/contactSegments.test.ts`:

```typescript
import { buildStateSegments } from './contactSegments'

describe('buildStateSegments', () => {
  const isActive = (v: number) => v === 1

  it('returns no segments when there are no points', () => {
    expect(buildStateSegments([], FROM, TO, { isActive })).toEqual([])
  })

  it('emits a single active segment spanning the whole range when state never changes', () => {
    const points = [point('2026-08-01T00:10:00Z', 1), point('2026-08-01T00:40:00Z', 1)]

    expect(buildStateSegments(points, FROM, TO, { isActive })).toEqual([
      { active: true, startMs: FROM, endMs: TO },
    ])
  })

  it('splits into segments at each observed state change', () => {
    const points = [point('2026-08-01T00:20:00Z', 1), point('2026-08-01T00:40:00Z', 0)]
    const t1 = new Date('2026-08-01T00:40:00Z').getTime()

    expect(buildStateSegments(points, FROM, TO, { isActive })).toEqual([
      { active: true, startMs: FROM, endMs: t1 },
      { active: false, startMs: t1, endMs: TO },
    ])
  })

  it('supports a custom predicate mapping "true" values to different scalars', () => {
    const isActiveTrue = (v: number) => v > 0
    const points = [point('2026-08-01T00:10:00Z', 254), point('2026-08-01T00:40:00Z', 0)]
    const t1 = new Date('2026-08-01T00:40:00Z').getTime()

    expect(buildStateSegments(points, FROM, TO, { isActive: isActiveTrue })).toEqual([
      { active: true, startMs: FROM, endMs: t1 },
      { active: false, startMs: t1, endMs: TO },
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- src/modules/devices/lib/contactSegments.test.ts --run`

Expected: FAIL — `buildStateSegments` is not exported.

- [ ] **Step 3: Write minimal implementation**

Replace `/Users/jakub/smart-home-core/frontend/src/modules/devices/lib/contactSegments.ts`:

```typescript
import type { TelemetryPoint } from '../types/telemetry'

export interface StateSegment {
  active: boolean
  startMs: number
  endMs: number
}

export interface ContactSegment {
  /** true = closed, false = open. Kept for callers that predate buildStateSegments. */
  closed: boolean
  startMs: number
  endMs: number
}

interface BuildStateSegmentsOptions {
  isActive: (value: number) => boolean
}

/**
 * Builds contiguous active/inactive segments spanning [fromMs, toMs]. The state
 * before the first observed point is assumed to equal that point's value —
 * there is no earlier data to know otherwise.
 */
export function buildStateSegments(
  points: TelemetryPoint[],
  fromMs: number,
  toMs: number,
  { isActive }: BuildStateSegmentsOptions,
): StateSegment[] {
  if (points.length === 0) return []

  const sorted = [...points].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
  const segments: StateSegment[] = []
  let currentState = isActive(sorted[0].value)
  let segmentStart = fromMs

  for (const p of sorted) {
    const t = new Date(p.time).getTime()
    const state = isActive(p.value)
    if (t <= segmentStart) {
      currentState = state
      continue
    }
    if (state !== currentState) {
      segments.push({ active: currentState, startMs: segmentStart, endMs: t })
      segmentStart = t
      currentState = state
    }
  }

  segments.push({ active: currentState, startMs: segmentStart, endMs: toMs })
  return segments
}

export function buildContactSegments(
  points: TelemetryPoint[],
  fromMs: number,
  toMs: number,
): ContactSegment[] {
  return buildStateSegments(points, fromMs, toMs, { isActive: (v) => v === 1 }).map((s) => ({
    closed: s.active,
    startMs: s.startMs,
    endMs: s.endMs,
  }))
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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- src/modules/devices/lib/contactSegments.test.ts --run`

Expected: PASS (both new and existing test cases).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/devices/lib/contactSegments.ts frontend/src/modules/devices/lib/contactSegments.test.ts
git commit -m "$(cat <<'EOF'
refactor(frontend): factor buildStateSegments out of contactSegments

Introduces a generic predicate-based segmenter shared between the
existing contact door timeline and the upcoming light on/off timeline.
buildContactSegments is preserved as a thin wrapper.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Generalize `ContactTimeline` to accept label + color-class props

**Files:**
- Modify: `/Users/jakub/smart-home-core/frontend/src/modules/devices/components/ContactTimeline.tsx`
- Modify: `/Users/jakub/smart-home-core/frontend/src/modules/devices/components/ContactTimelineCard.tsx`
- Test: `/Users/jakub/smart-home-core/frontend/src/modules/devices/components/ContactTimeline.test.tsx`

**Interfaces:**
- Consumes: `buildStateSegments`, `formatDuration` from Task 5; `TelemetryPoint`.
- Produces:
  - New props on `ContactTimeline` (all optional, defaults preserve door behaviour): `field?: string` (default `'contact'`), `isActive?: (v: number) => boolean` (default `v === 1`), `activeLabel?: string` (default `'zavřeno'`), `inactiveLabel?: string` (default `'otevřeno'`), `activeBadgeClass?: string` (default `'border-ok/40 bg-ok/10 text-ok'`), `inactiveBadgeClass?: string` (default `'border-danger/40 bg-danger/10 text-danger'`), `activeBarClass?: string` (default `'bg-ok'`), `inactiveBarClass?: string` (default `'bg-danger'`).
  - `ContactTimelineCard` forwards a `field` prop (default `'contact'`) and all optional label/color props.

- [ ] **Step 1: Write the failing test**

Append to `/Users/jakub/smart-home-core/frontend/src/modules/devices/components/ContactTimeline.test.tsx`:

```typescript
it('renders custom labels and a custom no-data message', () => {
  render(
    <ContactTimeline
      points={[]}
      fromMs={FROM}
      toMs={TO}
      field="state"
      isActive={(v) => v === 1}
      activeLabel="zapnuto"
      inactiveLabel="vypnuto"
      activeBadgeClass="border-accent/40 bg-accent/10 text-accent"
      inactiveBadgeClass="border-line bg-surface-sunken text-ink-muted"
      activeBarClass="bg-accent"
      inactiveBarClass="bg-surface-sunken"
    />,
  )

  expect(screen.getByText('No data for "state" in this range.')).toBeInTheDocument()
})

it('renders the active custom label and bar color when currentValue is active', () => {
  const points: TelemetryPoint[] = [{ time: '2026-08-01T00:10:00Z', value: 1 }]

  const { container } = render(
    <ContactTimeline
      points={points}
      fromMs={FROM}
      toMs={TO}
      currentValue={1}
      activeLabel="zapnuto"
      inactiveLabel="vypnuto"
      activeBarClass="bg-accent"
      inactiveBarClass="bg-surface-sunken"
    />,
  )

  expect(screen.getByText('zapnuto')).toBeInTheDocument()
  expect(container.querySelector('.bg-accent')).not.toBeNull()
})

it('lists a transition using the custom labels', () => {
  const points: TelemetryPoint[] = [
    { time: '2026-08-01T00:10:00Z', value: 1 },
    { time: '2026-08-01T00:29:00Z', value: 0 },
    { time: '2026-08-01T00:31:00Z', value: 1 },
  ]

  render(
    <ContactTimeline
      points={points}
      fromMs={FROM}
      toMs={TO}
      currentValue={1}
      activeLabel="zapnuto"
      inactiveLabel="vypnuto"
    />,
  )

  expect(screen.getByText(/vypnuto \(2 min\)/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- src/modules/devices/components/ContactTimeline.test.tsx --run`

Expected: FAIL — component ignores the new prop names (renders `zavřeno` instead of `zapnuto`) and hard-codes the `"contact"` message.

- [ ] **Step 3: Write minimal implementation**

Replace `/Users/jakub/smart-home-core/frontend/src/modules/devices/components/ContactTimeline.tsx`:

```typescript
import { buildStateSegments, formatDuration } from '../lib/contactSegments'
import type { TelemetryPoint } from '../types/telemetry'

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ContactTimeline({
  points,
  fromMs,
  toMs,
  currentValue,
  field = 'contact',
  isActive = (v: number) => v === 1,
  activeLabel = 'zavřeno',
  inactiveLabel = 'otevřeno',
  activeBadgeClass = 'border-ok/40 bg-ok/10 text-ok',
  inactiveBadgeClass = 'border-danger/40 bg-danger/10 text-danger',
  activeBarClass = 'bg-ok',
  inactiveBarClass = 'bg-danger',
}: {
  points: TelemetryPoint[]
  fromMs: number
  toMs: number
  currentValue?: number
  field?: string
  isActive?: (value: number) => boolean
  activeLabel?: string
  inactiveLabel?: string
  activeBadgeClass?: string
  inactiveBadgeClass?: string
  activeBarClass?: string
  inactiveBarClass?: string
}) {
  const segments = buildStateSegments(points, fromMs, toMs, { isActive })

  const active =
    currentValue !== undefined
      ? isActive(currentValue)
      : points.length > 0
        ? segments[segments.length - 1].active
        : undefined

  if (active === undefined) {
    return <p className="text-sm text-ink-muted">No data for "{field}" in this range.</p>
  }

  const recentTransitions = segments.length > 1 ? [...segments.slice(1)].reverse().slice(0, 5) : []

  return (
    <div>
      <span
        className={`inline-block rounded-full border px-3 py-1 text-sm ${
          active ? activeBadgeClass : inactiveBadgeClass
        }`}
      >
        {active ? activeLabel : inactiveLabel}
      </span>

      {segments.length > 0 && (
        <div className="mt-4 flex h-7 overflow-hidden rounded-md">
          {segments.map((segment, i) => (
            <div
              key={i}
              className={segment.active ? activeBarClass : inactiveBarClass}
              style={{ width: `${((segment.endMs - segment.startMs) / (toMs - fromMs)) * 100}%` }}
            />
          ))}
        </div>
      )}

      <div className="mt-3 font-mono text-xs text-ink-muted tabular-nums">
        {recentTransitions.length > 0 ? (
          recentTransitions.map((segment, i) => (
            <div key={i}>
              {formatTime(segment.startMs)}–{formatTime(segment.endMs)}{' '}
              {segment.active ? activeLabel : inactiveLabel} ({formatDuration(segment.endMs - segment.startMs)})
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

Replace `/Users/jakub/smart-home-core/frontend/src/modules/devices/components/ContactTimelineCard.tsx`:

```typescript
import { usePolling } from '@/hooks/usePolling'
import { getRangeBounds, getTelemetryHistory } from '../api/telemetry'
import type { TimeRange } from '../types/telemetry'
import { ContactTimeline } from './ContactTimeline'

const REFRESH_INTERVAL_MS = 15_000

export function ContactTimelineCard({
  deviceKey,
  range,
  currentValue,
  field = 'contact',
  isActive,
  activeLabel,
  inactiveLabel,
  activeBadgeClass,
  inactiveBadgeClass,
  activeBarClass,
  inactiveBarClass,
}: {
  deviceKey: string
  range: TimeRange
  currentValue?: number
  field?: string
  isActive?: (value: number) => boolean
  activeLabel?: string
  inactiveLabel?: string
  activeBadgeClass?: string
  inactiveBadgeClass?: string
  activeBarClass?: string
  inactiveBarClass?: string
}) {
  const { data } = usePolling(() => getTelemetryHistory(deviceKey, field, range), REFRESH_INTERVAL_MS, [
    deviceKey,
    field,
    range,
  ])
  const { from, to } = getRangeBounds(range)

  return (
    <div className="rounded-2xl border border-line bg-surface-raised p-4">
      <h3 className="mb-3 font-mono text-xs tracking-wider text-ink-muted uppercase">{field}</h3>
      <ContactTimeline
        points={data?.points ?? []}
        fromMs={from.getTime()}
        toMs={to.getTime()}
        currentValue={currentValue}
        field={field}
        isActive={isActive}
        activeLabel={activeLabel}
        inactiveLabel={inactiveLabel}
        activeBadgeClass={activeBadgeClass}
        inactiveBadgeClass={inactiveBadgeClass}
        activeBarClass={activeBarClass}
        inactiveBarClass={inactiveBarClass}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- src/modules/devices/components/ContactTimeline.test.tsx --run`

Expected: PASS. Also confirm no callers regressed:
Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- --run`

Expected: PASS (existing default door behaviour preserved).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/devices/components/ContactTimeline.tsx frontend/src/modules/devices/components/ContactTimelineCard.tsx frontend/src/modules/devices/components/ContactTimeline.test.tsx
git commit -m "$(cat <<'EOF'
refactor(frontend): parameterize ContactTimeline labels and colors

Optional props (activeLabel, inactiveLabel, badge/bar class overrides,
field, isActive predicate) default to today's door semantics so the
existing usage is untouched; new light-state timeline can now reuse
the same component.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Introduce `StateTimelineCard` wrapper for light on/off

**Files:**
- Create: `/Users/jakub/smart-home-core/frontend/src/modules/devices/components/StateTimelineCard.tsx`
- Test: `/Users/jakub/smart-home-core/frontend/src/modules/devices/components/StateTimelineCard.test.tsx`

**Interfaces:**
- Consumes: `ContactTimelineCard` from Task 6.
- Produces: `<StateTimelineCard deviceKey={string} range={TimeRange} currentValue?={number} />` — a thin wrapper that renders `ContactTimelineCard` with `field="state"`, `activeLabel="zapnuto"`, `inactiveLabel="vypnuto"`, and the accent/neutral color pair (`border-accent/40 bg-accent/10 text-accent` / `border-line bg-surface-sunken text-ink-muted` for badge; `bg-accent` / `bg-surface-sunken` for bar).

- [ ] **Step 1: Write the failing test**

Create `/Users/jakub/smart-home-core/frontend/src/modules/devices/components/StateTimelineCard.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StateTimelineCard } from './StateTimelineCard'

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}

describe('StateTimelineCard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('renders the state field header and Czech labels for an ON light', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        deviceName: 'lamp',
        field: 'state',
        points: [{ time: '2026-08-01T00:10:00Z', value: 1 }],
      }),
    )

    render(<StateTimelineCard deviceKey="0xaaa" range="24h" currentValue={1} />)

    expect(await screen.findByText('state')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('zapnuto')).toBeInTheDocument())
  })

  it('queries the state field from the telemetry endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ deviceName: 'lamp', field: 'state', points: [] }),
    )

    render(<StateTimelineCard deviceKey="0xaaa" range="24h" />)

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/telemetry/0xaaa?field=state'),
        expect.anything(),
      ),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- src/modules/devices/components/StateTimelineCard.test.tsx --run`

Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `/Users/jakub/smart-home-core/frontend/src/modules/devices/components/StateTimelineCard.tsx`:

```typescript
import type { TimeRange } from '../types/telemetry'
import { ContactTimelineCard } from './ContactTimelineCard'

/**
 * Light on/off timeline. Uses the accent/surface-sunken color pair rather
 * than the door's danger/ok semantics — a light being on is not a safety
 * state, just a mode.
 */
export function StateTimelineCard({
  deviceKey,
  range,
  currentValue,
}: {
  deviceKey: string
  range: TimeRange
  currentValue?: number
}) {
  return (
    <ContactTimelineCard
      deviceKey={deviceKey}
      range={range}
      currentValue={currentValue}
      field="state"
      isActive={(v) => v === 1}
      activeLabel="zapnuto"
      inactiveLabel="vypnuto"
      activeBadgeClass="border-accent/40 bg-accent/10 text-accent"
      inactiveBadgeClass="border-line bg-surface-sunken text-ink-muted"
      activeBarClass="bg-accent"
      inactiveBarClass="bg-surface-sunken"
    />
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- src/modules/devices/components/StateTimelineCard.test.tsx --run`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/devices/components/StateTimelineCard.tsx frontend/src/modules/devices/components/StateTimelineCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): add StateTimelineCard wrapper for light on/off history

Thin composition over ContactTimelineCard with the state field name
and an accent/neutral color pair distinct from the door's ok/danger.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Add `computeDelta` and `trendWord` helpers for stat cards

**Files:**
- Create: `/Users/jakub/smart-home-core/frontend/src/modules/devices/lib/trend.ts`
- Test: `/Users/jakub/smart-home-core/frontend/src/modules/devices/lib/trend.test.ts`

**Interfaces:**
- Consumes: `TelemetryPoint`.
- Produces:
  - `computeDelta(points: TelemetryPoint[]): number | null` — last value minus first value across at least two chronologically-sorted points; `null` if fewer than two.
  - `formatSignedDelta(delta: number, unit: string, digits?: number): string` — e.g. `+0.6°` / `-1.2°` / `0.0°` with the sign prefix.
  - `trendWord(delta: number | null, threshold: number): 'stabilní' | 'stoupá' | 'klesá'` — `'stabilní'` for null or `|delta| <= threshold`, else `'stoupá'` / `'klesá'`.
  - `rangeLabel(range: TimeRange): string` — Czech phrase for the range window: `'za hodinu'`, `'za 6 hodin'`, `'za 24 hodin'`, `'za týden'`, `'za měsíc'`.

- [ ] **Step 1: Write the failing test**

Create `/Users/jakub/smart-home-core/frontend/src/modules/devices/lib/trend.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { computeDelta, formatSignedDelta, rangeLabel, trendWord } from './trend'
import type { TelemetryPoint } from '../types/telemetry'

function p(iso: string, value: number): TelemetryPoint {
  return { time: iso, value }
}

describe('computeDelta', () => {
  it('returns null for fewer than two points', () => {
    expect(computeDelta([])).toBeNull()
    expect(computeDelta([p('2026-08-01T00:00:00Z', 20)])).toBeNull()
  })

  it('returns last minus first across chronologically-sorted points', () => {
    const points = [p('2026-08-01T00:00:00Z', 20), p('2026-08-01T01:00:00Z', 20.6)]
    expect(computeDelta(points)).toBeCloseTo(0.6, 5)
  })

  it('sorts by time before computing', () => {
    const points = [p('2026-08-01T01:00:00Z', 20.6), p('2026-08-01T00:00:00Z', 20)]
    expect(computeDelta(points)).toBeCloseTo(0.6, 5)
  })
})

describe('formatSignedDelta', () => {
  it('prefixes + for positive values', () => {
    expect(formatSignedDelta(0.6, '°', 1)).toBe('+0.6°')
  })

  it('shows − for negative values', () => {
    expect(formatSignedDelta(-1.2, '°', 1)).toBe('-1.2°')
  })

  it('shows 0 without a sign', () => {
    expect(formatSignedDelta(0, '°', 1)).toBe('0.0°')
  })
})

describe('trendWord', () => {
  it('is stabilní for null or below threshold', () => {
    expect(trendWord(null, 2)).toBe('stabilní')
    expect(trendWord(1.5, 2)).toBe('stabilní')
    expect(trendWord(-1.5, 2)).toBe('stabilní')
  })

  it('is stoupá when delta exceeds threshold', () => {
    expect(trendWord(3, 2)).toBe('stoupá')
  })

  it('is klesá when delta is below negative threshold', () => {
    expect(trendWord(-3, 2)).toBe('klesá')
  })
})

describe('rangeLabel', () => {
  it('maps each range to its Czech phrase', () => {
    expect(rangeLabel('1h')).toBe('za hodinu')
    expect(rangeLabel('6h')).toBe('za 6 hodin')
    expect(rangeLabel('24h')).toBe('za 24 hodin')
    expect(rangeLabel('7d')).toBe('za týden')
    expect(rangeLabel('30d')).toBe('za měsíc')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- src/modules/devices/lib/trend.test.ts --run`

Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `/Users/jakub/smart-home-core/frontend/src/modules/devices/lib/trend.ts`:

```typescript
import type { TelemetryPoint, TimeRange } from '../types/telemetry'

export function computeDelta(points: TelemetryPoint[]): number | null {
  if (points.length < 2) return null
  const sorted = [...points].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
  return sorted[sorted.length - 1].value - sorted[0].value
}

export function formatSignedDelta(delta: number, unit: string, digits = 1): string {
  const abs = Math.abs(delta).toFixed(digits)
  if (delta > 0) return `+${abs}${unit}`
  if (delta < 0) return `-${abs}${unit}`
  return `${abs}${unit}`
}

export function trendWord(delta: number | null, threshold: number): 'stabilní' | 'stoupá' | 'klesá' {
  if (delta === null || Math.abs(delta) <= threshold) return 'stabilní'
  return delta > 0 ? 'stoupá' : 'klesá'
}

const RANGE_LABELS: Record<TimeRange, string> = {
  '1h': 'za hodinu',
  '6h': 'za 6 hodin',
  '24h': 'za 24 hodin',
  '7d': 'za týden',
  '30d': 'za měsíc',
}

export function rangeLabel(range: TimeRange): string {
  return RANGE_LABELS[range]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- src/modules/devices/lib/trend.test.ts --run`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/devices/lib/trend.ts frontend/src/modules/devices/lib/trend.test.ts
git commit -m "$(cat <<'EOF'
feat(frontend): add trend helpers for room stat cards

Pure utilities (delta, signed formatter, trend word, Czech range label)
consumed by the upcoming per-device stat card row.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Introduce `RoomStatCards` — one compact card per device instance

**Files:**
- Create: `/Users/jakub/smart-home-core/frontend/src/modules/home/components/RoomStatCards.tsx`
- Test: `/Users/jakub/smart-home-core/frontend/src/modules/home/components/RoomStatCards.test.tsx`

**Interfaces:**
- Consumes: `Device`, `TimeRange`, `getLatestTelemetry`, `getTelemetryHistory`, `usePolling`, `computeDelta`, `formatSignedDelta`, `trendWord`, `rangeLabel` (Task 8).
- Produces: `<RoomStatCards devices={Device[]} range={TimeRange} />` — renders a horizontal wrap of small cards. Card content per type:
  - `SENSOR` with temperature: current `X.X°C`, `formatSignedDelta(delta, '°') + ' ' + rangeLabel(range)`, tiny sparkline (`Recharts` LineChart, no axes, height ~40).
  - `SENSOR` with humidity: current `Y%`, `trendWord(...)`, sparkline.
  - `SENSOR` with contact: chip `Zavřeno`/`Otevřeno` (`bg-ok`/`bg-danger` mapping), `naposledy otevřeno HH:MM` from the last transition segment (via `buildStateSegments` with `isActive: v => v === 1`).
  - `LIGHT`/`SWITCH`/`PLUG`: chip `Zapnuto`/`Vypnuto`; if `LIGHT` and `state === 'ON'` show `Math.round(brightness / 254 * 100) + ' %'`.
  A device with both temperature and humidity renders as two cards. A device with no supported reading is omitted.

- [ ] **Step 1: Write the failing test**

Create `/Users/jakub/smart-home-core/frontend/src/modules/home/components/RoomStatCards.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Device } from '@/modules/devices/types/device'
import { RoomStatCards } from './RoomStatCards'

function device(overrides: Partial<Device> = {}): Device {
  return {
    id: 1,
    ieeeAddress: '0xaaa',
    friendlyName: 'Bedroom temp',
    type: 'SENSOR',
    vendor: null,
    model: null,
    available: true,
    state: null,
    brightness: null,
    colorTemp: null,
    lastSeen: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}

describe('RoomStatCards', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('renders one card per numeric field on a climate sensor', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/latest')) {
        return Promise.resolve(jsonResponse({ deviceName: 'Bedroom temp', values: { temperature: 21.5, humidity: 48 }, lastUpdated: null }))
      }
      return Promise.resolve(jsonResponse({ deviceName: 'Bedroom temp', field: 'temperature', points: [
        { time: '2026-08-06T00:00:00Z', value: 21.0 },
        { time: '2026-08-06T01:00:00Z', value: 21.5 },
      ] }))
    })

    render(<RoomStatCards devices={[device()]} range="1h" />)

    expect(await screen.findByText('21.5°C')).toBeInTheDocument()
    expect(await screen.findByText('48 %')).toBeInTheDocument()
  })

  it('renders two temperature cards for a room with two temperature sensors', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/telemetry/0xaaa/latest')) {
        return Promise.resolve(jsonResponse({ deviceName: 'A', values: { temperature: 21.5 }, lastUpdated: null }))
      }
      if (url.includes('/api/telemetry/0xbbb/latest')) {
        return Promise.resolve(jsonResponse({ deviceName: 'B', values: { temperature: 19.0 }, lastUpdated: null }))
      }
      return Promise.resolve(jsonResponse({ deviceName: 'x', field: 'temperature', points: [] }))
    })

    render(
      <RoomStatCards
        devices={[
          device({ id: 1, ieeeAddress: '0xaaa', friendlyName: 'A' }),
          device({ id: 2, ieeeAddress: '0xbbb', friendlyName: 'B' }),
        ]}
        range="1h"
      />,
    )

    expect(await screen.findByText('21.5°C')).toBeInTheDocument()
    expect(await screen.findByText('19.0°C')).toBeInTheDocument()
  })

  it('renders contact chip with Zavřeno/Otevřeno for a door sensor', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/latest')) {
        return Promise.resolve(jsonResponse({ deviceName: 'door', values: { contact: 0 }, lastUpdated: null }))
      }
      return Promise.resolve(jsonResponse({ deviceName: 'door', field: 'contact', points: [] }))
    })

    render(<RoomStatCards devices={[device({ friendlyName: 'Dveře' })]} range="24h" />)

    expect(await screen.findByText('Otevřeno')).toBeInTheDocument()
  })

  it('renders light card with brightness percent when ON', async () => {
    render(
      <RoomStatCards
        devices={[device({ id: 2, ieeeAddress: '0xbbb', friendlyName: 'Lamp', type: 'LIGHT', state: 'ON', brightness: 127 })]}
        range="24h"
      />,
    )

    expect(await screen.findByText('Zapnuto')).toBeInTheDocument()
    expect(screen.getByText('50 %')).toBeInTheDocument()
  })

  it('renders light card with no brightness when OFF', async () => {
    render(
      <RoomStatCards
        devices={[device({ id: 2, ieeeAddress: '0xbbb', friendlyName: 'Lamp', type: 'LIGHT', state: 'OFF', brightness: 200 })]}
        range="24h"
      />,
    )

    expect(await screen.findByText('Vypnuto')).toBeInTheDocument()
    expect(screen.queryByText('%')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- src/modules/home/components/RoomStatCards.test.tsx --run`

Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `/Users/jakub/smart-home-core/frontend/src/modules/home/components/RoomStatCards.tsx`:

```typescript
import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { Line, LineChart, ResponsiveContainer } from 'recharts'
import { usePolling } from '@/hooks/usePolling'
import { getLatestTelemetry, getTelemetryHistory } from '@/modules/devices/api/telemetry'
import { buildStateSegments } from '@/modules/devices/lib/contactSegments'
import { computeDelta, formatSignedDelta, rangeLabel, trendWord } from '@/modules/devices/lib/trend'
import type { Device } from '@/modules/devices/types/device'
import type { TelemetryPoint, TimeRange } from '@/modules/devices/types/telemetry'
import { IconBulb, IconDroplet, IconPlug, IconSensor, IconSwitch, IconThermometer } from '@/ui/icons'

const REFRESH_INTERVAL_MS = 15_000

const HUMIDITY_TREND_THRESHOLD = 2

interface StatCardShellProps {
  device: Device
  icon: ComponentType<{ className?: string }>
  primary: string
  secondary?: string
  children?: React.ReactNode
}

function StatCardShell({ device, icon: Icon, primary, secondary, children }: StatCardShellProps) {
  return (
    <section className="flex min-w-[220px] flex-1 flex-col rounded-2xl border border-line bg-surface-raised p-4">
      <Link to={`/device/${device.id}`} className="flex items-center gap-2 text-ink-muted hover:text-accent">
        <Icon className="size-4 shrink-0" />
        <h3 className="truncate text-sm">{device.friendlyName}</h3>
      </Link>
      <p className="mt-2 font-mono text-2xl font-semibold text-ink">{primary}</p>
      {secondary && <p className="mt-1 text-xs text-ink-muted">{secondary}</p>}
      {children}
    </section>
  )
}

function Sparkline({ points, color }: { points: TelemetryPoint[]; color: string }) {
  if (points.length < 2) return null
  const data = points.map((p) => ({ time: p.time, value: p.value }))
  return (
    <div className="mt-3 h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function TemperatureStatCard({ device, temperature, range }: { device: Device; temperature: number; range: TimeRange }) {
  const { data } = usePolling(
    () => getTelemetryHistory(device.ieeeAddress, 'temperature', range),
    REFRESH_INTERVAL_MS,
    [device.ieeeAddress, range],
  )
  const delta = computeDelta(data?.points ?? [])
  const secondary = delta !== null ? `${formatSignedDelta(delta, '°')} ${rangeLabel(range)}` : undefined

  return (
    <StatCardShell device={device} icon={IconThermometer} primary={`${temperature.toFixed(1)}°C`} secondary={secondary}>
      <Sparkline points={data?.points ?? []} color="currentColor" />
    </StatCardShell>
  )
}

function HumidityStatCard({ device, humidity, range }: { device: Device; humidity: number; range: TimeRange }) {
  const { data } = usePolling(
    () => getTelemetryHistory(device.ieeeAddress, 'humidity', range),
    REFRESH_INTERVAL_MS,
    [device.ieeeAddress, range],
  )
  const delta = computeDelta(data?.points ?? [])
  const trend = trendWord(delta, HUMIDITY_TREND_THRESHOLD)

  return (
    <StatCardShell device={device} icon={IconDroplet} primary={`${Math.round(humidity)} %`} secondary={trend}>
      <Sparkline points={data?.points ?? []} color="currentColor" />
    </StatCardShell>
  )
}

function ContactStatCard({ device, contact, range }: { device: Device; contact: number; range: TimeRange }) {
  const { data } = usePolling(
    () => getTelemetryHistory(device.ieeeAddress, 'contact', range),
    REFRESH_INTERVAL_MS,
    [device.ieeeAddress, range],
  )
  const isClosed = contact === 1
  const points = data?.points ?? []
  const fromMs = points.length > 0 ? new Date(points[0].time).getTime() : Date.now()
  const toMs = Date.now()
  const segments = buildStateSegments(points, fromMs, toMs, { isActive: (v) => v === 1 })
  const lastOpenTransition = [...segments].reverse().find((s) => !s.active)
  const secondary = lastOpenTransition
    ? `naposledy otevřeno ${new Date(lastOpenTransition.startMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : undefined

  return (
    <StatCardShell
      device={device}
      icon={IconSensor}
      primary={isClosed ? 'Zavřeno' : 'Otevřeno'}
      secondary={secondary}
    >
      <span
        className={`mt-2 inline-block h-1.5 w-full rounded-full ${isClosed ? 'bg-ok' : 'bg-danger'}`}
        aria-hidden
      />
    </StatCardShell>
  )
}

function LightStatCard({ device }: { device: Device }) {
  const isOn = device.state === 'ON'
  const brightnessPct = device.brightness !== null ? Math.round((device.brightness / 254) * 100) : null
  const secondary = isOn && brightnessPct !== null ? `${brightnessPct} %` : undefined
  const icon = device.type === 'LIGHT' ? IconBulb : device.type === 'PLUG' ? IconPlug : IconSwitch

  return <StatCardShell device={device} icon={icon} primary={isOn ? 'Zapnuto' : 'Vypnuto'} secondary={secondary} />
}

function SensorCards({ device, range }: { device: Device; range: TimeRange }) {
  const { data: latest } = usePolling(
    () => getLatestTelemetry(device.ieeeAddress),
    REFRESH_INTERVAL_MS,
    [device.ieeeAddress],
  )
  if (!latest) return null

  const cards = []
  if (typeof latest.values.temperature === 'number') {
    cards.push(<TemperatureStatCard key={`${device.id}-t`} device={device} temperature={latest.values.temperature} range={range} />)
  }
  if (typeof latest.values.humidity === 'number') {
    cards.push(<HumidityStatCard key={`${device.id}-h`} device={device} humidity={latest.values.humidity} range={range} />)
  }
  if (typeof latest.values.contact === 'number') {
    cards.push(<ContactStatCard key={`${device.id}-c`} device={device} contact={latest.values.contact} range={range} />)
  }
  return <>{cards}</>
}

export function RoomStatCards({ devices, range }: { devices: Device[]; range: TimeRange }) {
  return (
    <div className="flex flex-wrap gap-4">
      {devices.map((device) => {
        if (device.type === 'LIGHT' || device.type === 'SWITCH' || device.type === 'PLUG') {
          return <LightStatCard key={device.id} device={device} />
        }
        if (device.type === 'SENSOR') {
          return <SensorCards key={device.id} device={device} range={range} />
        }
        return null
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- src/modules/home/components/RoomStatCards.test.tsx --run`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/home/components/RoomStatCards.tsx frontend/src/modules/home/components/RoomStatCards.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): add RoomStatCards row for room detail redesign

One compact card per device instance (multi-sensor rooms get one card
each), with per-type content: temperature delta + sparkline, humidity
trend word, contact chip + last-open transition, light on/off + %.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Introduce `RoomHistorySections` — always-visible full-width history

**Files:**
- Create: `/Users/jakub/smart-home-core/frontend/src/modules/home/components/RoomHistorySections.tsx`
- Test: `/Users/jakub/smart-home-core/frontend/src/modules/home/components/RoomHistorySections.test.tsx`

**Interfaces:**
- Consumes: `Device`, `TimeRange`, `TelemetryFieldChart`, `ContactTimelineCard`, `StateTimelineCard` (Task 7), `getLatestTelemetry`, `usePolling`.
- Produces: `<RoomHistorySections devices={Device[]} range={TimeRange} />` — orders and renders per-device history sections: temperature charts, then humidity charts, then contact timelines, then light state timelines. Each section is a `<section>` with an `h3` friendly-name header and the field's history component full width. A section is emitted only if that device actually has data for that field (temperature/humidity/contact based on `getLatestTelemetry` values; light based on `device.type === 'LIGHT'`).

- [ ] **Step 1: Write the failing test**

Create `/Users/jakub/smart-home-core/frontend/src/modules/home/components/RoomHistorySections.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Device } from '@/modules/devices/types/device'
import { RoomHistorySections } from './RoomHistorySections'

function device(overrides: Partial<Device> = {}): Device {
  return {
    id: 1,
    ieeeAddress: '0xaaa',
    friendlyName: 'Bedroom temp',
    type: 'SENSOR',
    vendor: null,
    model: null,
    available: true,
    state: null,
    brightness: null,
    colorTemp: null,
    lastSeen: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}

describe('RoomHistorySections', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('emits temperature, humidity, contact, and light sections in that order', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/telemetry/0xaaa/latest')) {
        return Promise.resolve(jsonResponse({ deviceName: 'Temp+Hum', values: { temperature: 20, humidity: 45 }, lastUpdated: null }))
      }
      if (url.includes('/api/telemetry/0xbbb/latest')) {
        return Promise.resolve(jsonResponse({ deviceName: 'Door', values: { contact: 1 }, lastUpdated: null }))
      }
      return Promise.resolve(jsonResponse({ deviceName: 'x', field: 'x', points: [] }))
    })

    render(
      <RoomHistorySections
        devices={[
          device({ id: 1, ieeeAddress: '0xaaa', friendlyName: 'Temp+Hum' }),
          device({ id: 2, ieeeAddress: '0xbbb', friendlyName: 'Door' }),
          device({ id: 3, ieeeAddress: '0xccc', friendlyName: 'Lamp', type: 'LIGHT' }),
        ]}
        range="24h"
      />,
    )

    await waitFor(() => expect(screen.getAllByRole('heading', { level: 3 }).length).toBeGreaterThanOrEqual(4))
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    const tempIndex = headings.findIndex((t) => t?.includes('Temp+Hum · teplota'))
    const humIndex = headings.findIndex((t) => t?.includes('Temp+Hum · vlhkost'))
    const contactIndex = headings.findIndex((t) => t?.includes('Door'))
    const lampIndex = headings.findIndex((t) => t?.includes('Lamp'))
    expect(tempIndex).toBeGreaterThanOrEqual(0)
    expect(humIndex).toBeGreaterThan(tempIndex)
    expect(contactIndex).toBeGreaterThan(humIndex)
    expect(lampIndex).toBeGreaterThan(contactIndex)
  })

  it('omits a section for a sensor with no matching field', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/telemetry/0xaaa/latest')) {
        return Promise.resolve(jsonResponse({ deviceName: 'Temp only', values: { temperature: 20 }, lastUpdated: null }))
      }
      return Promise.resolve(jsonResponse({ deviceName: 'x', field: 'x', points: [] }))
    })

    render(
      <RoomHistorySections
        devices={[device({ id: 1, ieeeAddress: '0xaaa', friendlyName: 'Temp only' })]}
        range="24h"
      />,
    )

    await waitFor(() => expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument())
    expect(screen.queryByText(/vlhkost/)).toBeNull()
    expect(screen.queryByText(/kontakt/)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- src/modules/home/components/RoomHistorySections.test.tsx --run`

Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `/Users/jakub/smart-home-core/frontend/src/modules/home/components/RoomHistorySections.tsx`:

```typescript
import { usePolling } from '@/hooks/usePolling'
import { getLatestTelemetry } from '@/modules/devices/api/telemetry'
import { ContactTimelineCard } from '@/modules/devices/components/ContactTimelineCard'
import { StateTimelineCard } from '@/modules/devices/components/StateTimelineCard'
import { TelemetryFieldChart } from '@/modules/devices/components/TelemetryFieldChart'
import type { Device } from '@/modules/devices/types/device'
import type { LatestTelemetryResponse, TimeRange } from '@/modules/devices/types/telemetry'

const REFRESH_INTERVAL_MS = 15_000

type SectionKind = 'temperature' | 'humidity' | 'contact' | 'state'

interface Section {
  key: string
  kind: SectionKind
  device: Device
  latest: LatestTelemetryResponse | null
}

const SECTION_ORDER: SectionKind[] = ['temperature', 'humidity', 'contact', 'state']

const FIELD_LABEL: Record<SectionKind, string> = {
  temperature: 'teplota',
  humidity: 'vlhkost',
  contact: 'kontakt',
  state: 'stav',
}

function useDeviceLatest(devices: Device[]) {
  return usePolling(
    () => Promise.all(devices.map((d) => getLatestTelemetry(d.ieeeAddress).catch(() => null))),
    REFRESH_INTERVAL_MS,
    [devices.map((d) => d.ieeeAddress).join(',')],
  )
}

export function RoomHistorySections({ devices, range }: { devices: Device[]; range: TimeRange }) {
  const { data: latestByDevice } = useDeviceLatest(devices)

  const sections: Section[] = []
  devices.forEach((device, i) => {
    const latest = latestByDevice?.[i] ?? null
    if (device.type === 'SENSOR') {
      if (latest && typeof latest.values.temperature === 'number') {
        sections.push({ key: `${device.id}-temperature`, kind: 'temperature', device, latest })
      }
      if (latest && typeof latest.values.humidity === 'number') {
        sections.push({ key: `${device.id}-humidity`, kind: 'humidity', device, latest })
      }
      if (latest && typeof latest.values.contact === 'number') {
        sections.push({ key: `${device.id}-contact`, kind: 'contact', device, latest })
      }
    }
    if (device.type === 'LIGHT') {
      sections.push({ key: `${device.id}-state`, kind: 'state', device, latest })
    }
  })

  sections.sort((a, b) => SECTION_ORDER.indexOf(a.kind) - SECTION_ORDER.indexOf(b.kind))

  return (
    <div className="mt-6 flex flex-col gap-6">
      {sections.map((section) => (
        <section key={section.key}>
          <h3 className="mb-2 text-sm text-ink-muted">
            {section.device.friendlyName} · {FIELD_LABEL[section.kind]}
          </h3>
          {section.kind === 'temperature' && (
            <TelemetryFieldChart deviceKey={section.device.ieeeAddress} field="temperature" range={range} />
          )}
          {section.kind === 'humidity' && (
            <TelemetryFieldChart deviceKey={section.device.ieeeAddress} field="humidity" range={range} />
          )}
          {section.kind === 'contact' && (
            <ContactTimelineCard
              deviceKey={section.device.ieeeAddress}
              range={range}
              currentValue={section.latest?.values.contact}
            />
          )}
          {section.kind === 'state' && (
            <StateTimelineCard
              deviceKey={section.device.ieeeAddress}
              range={range}
              currentValue={section.device.state === 'ON' ? 1 : section.device.state === 'OFF' ? 0 : undefined}
            />
          )}
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- src/modules/home/components/RoomHistorySections.test.tsx --run`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/home/components/RoomHistorySections.tsx frontend/src/modules/home/components/RoomHistorySections.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): add RoomHistorySections always-visible history stack

Full-width, always-mounted sections ordered temperature → humidity →
contact → light state; no toggle. Emits nothing for a device+field
combination with no data.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Wire `RoomStatCards` + `RoomHistorySections` into `RoomDetailPage`

**Files:**
- Modify: `/Users/jakub/smart-home-core/frontend/src/modules/home/pages/RoomDetailPage.tsx:1-72`
- Test: `/Users/jakub/smart-home-core/frontend/src/modules/home/pages/RoomDetailPage.test.tsx`

**Interfaces:**
- Consumes: `RoomStatCards` (Task 9), `RoomHistorySections` (Task 10).
- Produces: `RoomDetailPage` no longer imports `RoomTelemetryWidgets`; renders `<RoomStatCards>` then `<RoomHistorySections>` beneath the range picker.

- [ ] **Step 1: Write the failing test**

Append to the existing `describe` in `/Users/jakub/smart-home-core/frontend/src/modules/home/pages/RoomDetailPage.test.tsx`:

```typescript
it('shows stat cards and history sections instead of the old masonry widgets', async () => {
  vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    if (url === DEVICES_PATH) {
      return Promise.resolve(
        jsonResponse([
          device({ id: 1, ieeeAddress: '0xe456acfffe5dc028', friendlyName: 'Office temp', type: 'SENSOR' }),
        ]),
      )
    }
    if (url === '/api/telemetry/0xe456acfffe5dc028/latest') {
      return Promise.resolve(
        jsonResponse({ deviceName: 'Office temp', values: { temperature: 22 }, lastUpdated: null }),
      )
    }
    if (url.startsWith('/api/telemetry/0xe456acfffe5dc028?')) {
      return Promise.resolve(jsonResponse({ deviceName: 'Office temp', field: 'temperature', points: [] }))
    }
    return Promise.resolve(new Response('not found', { status: 404 }))
  })

  renderRoom('office')

  expect(await screen.findByText('22.0°C')).toBeInTheDocument()
  expect(await screen.findByRole('heading', { level: 3, name: /Office temp · teplota/ })).toBeInTheDocument()
  expect(screen.queryByText('Zobrazit historii')).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- src/modules/home/pages/RoomDetailPage.test.tsx --run`

Expected: FAIL — page still renders `RoomTelemetryWidgets` with `Zobrazit historii` and no `· teplota` heading.

- [ ] **Step 3: Write minimal implementation**

Replace `/Users/jakub/smart-home-core/frontend/src/modules/home/pages/RoomDetailPage.tsx`:

```typescript
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { getDeviceReadings } from '@/modules/devices/api/deviceReadings'
import { DeviceGrid } from '@/modules/devices/components/DeviceGrid'
import type { TimeRange } from '@/modules/devices/types/telemetry'
import { rooms } from '@/modules/roomMap/config/rooms'
import { usePolling } from '@/hooks/usePolling'
import { Loading } from '@/ui/Loading'
import { PageHeader } from '@/ui/PageHeader'
import { RoomHistorySections } from '../components/RoomHistorySections'
import { RoomStatCards } from '../components/RoomStatCards'

const REFRESH_INTERVAL_MS = 15_000
const TIME_RANGES: TimeRange[] = ['1h', '6h', '24h', '7d', '30d']

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
  const roomDevices = roomReadings.map((reading) => reading.device)

  return (
    <div className="h-full overflow-y-auto px-6 py-5 lg:px-8">
      <PageHeader title={room.label} back={{ to: '/', label: 'Home' }} />

      {loading && !readings && <Loading label="Načítám pokoj…" />}
      {error && <p className="text-danger">Failed to load room data: {error.message}</p>}

      {readings && (
        <>
          <DeviceGrid readings={roomReadings} variant="list" defaultCollapsed />

          <div className="mt-8">
            <div className="mb-4 inline-flex rounded-full border border-line bg-surface-raised p-1">
              {TIME_RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={`min-h-9 rounded-full px-4 font-mono text-sm transition ${
                    range === r ? 'bg-accent text-accent-ink' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <RoomStatCards devices={roomDevices} range={range} />
            <RoomHistorySections devices={roomDevices} range={range} />
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- src/modules/home/pages/RoomDetailPage.test.tsx --run`

Expected: PASS. Then run the full frontend suite:
Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- --run`

Expected: PASS everywhere except the now-obsolete `RoomTelemetryWidgets.test.tsx` (which will be deleted in Task 12).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/home/pages/RoomDetailPage.tsx frontend/src/modules/home/pages/RoomDetailPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): switch room detail to stat cards + history sections

Replaces the RoomTelemetryWidgets masonry with the fixed RoomStatCards
row and always-visible RoomHistorySections. Range picker restyled as a
pill/chip.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Delete `RoomTelemetryWidgets` and its tests

**Files:**
- Delete: `/Users/jakub/smart-home-core/frontend/src/modules/home/components/RoomTelemetryWidgets.tsx`
- Delete: `/Users/jakub/smart-home-core/frontend/src/modules/home/components/RoomTelemetryWidgets.test.tsx`

**Interfaces:**
- Consumes: nothing (Task 11 removed the last import).
- Produces: no more `RoomTelemetryWidgets` symbol; no more masonry-specific test.

- [ ] **Step 1: Write the failing test**

No new tests. The "failing" precondition is a repo grep proving nothing imports the deleted module:

Run: `grep -rn "RoomTelemetryWidgets" /Users/jakub/smart-home-core/frontend/src`

Expected before deletion: matches only in the two files being deleted (and no imports remain).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- --run`

Expected: fails inside `RoomTelemetryWidgets.test.tsx` because the surrounding refactor removed the toggle it asserted on (`Zobrazit historii`). This is the trigger for deletion.

- [ ] **Step 3: Write minimal implementation**

```bash
rm /Users/jakub/smart-home-core/frontend/src/modules/home/components/RoomTelemetryWidgets.tsx
rm /Users/jakub/smart-home-core/frontend/src/modules/home/components/RoomTelemetryWidgets.test.tsx
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- --run`

Expected: PASS across the whole suite.
Run: `cd /Users/jakub/smart-home-core/frontend && npx tsc --noEmit`

Expected: PASS (no dangling references).

- [ ] **Step 5: Commit**

```bash
git add -u frontend/src/modules/home/components/
git commit -m "$(cat <<'EOF'
chore(frontend): remove RoomTelemetryWidgets and its masonry tests

Superseded by RoomStatCards + RoomHistorySections. MasonryItem and the
ResizeObserver row-span logic are gone with it.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Delete superseded plan and design specs

**Files:**
- Delete: `/Users/jakub/smart-home-core/docs/superpowers/plans/2026-08-05-room-detail-widgets-and-state.md`
- Delete: `/Users/jakub/smart-home-core/docs/superpowers/specs/2026-08-05-room-detail-widgets-and-state-design.md`

**Interfaces:**
- Consumes: nothing.
- Produces: repository no longer carries the old planning artefacts explicitly marked as superseded in the current spec.

- [ ] **Step 1: Write the failing test**

No test; docs-only removal. Verification is that both paths exist:

Run: `ls /Users/jakub/smart-home-core/docs/superpowers/plans/2026-08-05-room-detail-widgets-and-state.md /Users/jakub/smart-home-core/docs/superpowers/specs/2026-08-05-room-detail-widgets-and-state-design.md`

Expected: both files listed.

- [ ] **Step 2: Run test to verify it fails**

Same `ls` — it succeeds today, which is what we're removing.

- [ ] **Step 3: Write minimal implementation**

```bash
rm /Users/jakub/smart-home-core/docs/superpowers/plans/2026-08-05-room-detail-widgets-and-state.md
rm /Users/jakub/smart-home-core/docs/superpowers/specs/2026-08-05-room-detail-widgets-and-state-design.md
```

- [ ] **Step 4: Run test to verify it passes**

Run: `ls /Users/jakub/smart-home-core/docs/superpowers/plans/2026-08-05-room-detail-widgets-and-state.md /Users/jakub/smart-home-core/docs/superpowers/specs/2026-08-05-room-detail-widgets-and-state-design.md 2>&1 | head`

Expected: `ls: … No such file or directory` on both.

Run the whole suite once more end-to-end to confirm nothing regressed:
Run: `cd /Users/jakub/smart-home-core/backend-python && pytest && cd /Users/jakub/smart-home-core/frontend && npm test -- --run`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -u docs/superpowers/plans/2026-08-05-room-detail-widgets-and-state.md docs/superpowers/specs/2026-08-05-room-detail-widgets-and-state-design.md
git commit -m "$(cat <<'EOF'
chore(docs): remove superseded room-detail widgets-and-state plan/spec

Replaced by the 2026-08-06 room-detail redesign spec now implemented.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```
