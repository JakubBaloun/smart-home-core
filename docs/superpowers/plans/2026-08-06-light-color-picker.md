# Light RGB Color Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full hue/saturation RGB color control end-to-end (DB, Z2M capability detection, command, MQTT read-back, frontend hand-rolled circular picker) for Zigbee2MQTT devices that support it, alongside the existing color-temp control behind a Bílá/Barva toggle.

**Architecture:** Backend stores raw Z2M `exposes` JSONB per device and derives a `supportsColor` boolean at read time; adds `hue`/`saturation` columns updated both by command and by MQTT state read-back. A new typed `set_color` command publishes `{"color":{"hue","saturation"}}` to Z2M. Frontend adds a hand-rolled SVG/CSS circular hue/saturation picker (`ColorWheel`) following the existing drag-local-state slider pattern in `LightControls.tsx`, gated behind `device.supportsColor`.

**Tech Stack:** Python 3.12 / FastAPI / SQLAlchemy 2.0 (JSONB, first use in this codebase) / paho-mqtt / Zigbee2MQTT (backend-python/); React 19 + TypeScript + Vite (frontend/); pytest + testcontainers (backend tests, DB never mocked); Vitest + Testing Library (frontend tests).

## Global Constraints

- Flyway is the single owner of the schema — new migration in `backend/src/main/resources/db/migration/`, then `backend-python/schema.sql` resnapshot. No Alembic.
- `bool` must be checked before the numeric branch wherever Z2M payload values are coerced (Python `isinstance(True, int)` is `True`).
- Backend tests never mock the database — testcontainers or `TEST_DB_URL`.
- No xy (CIE) color space — hue+saturation only (explicit non-goal in the spec).
- No new frontend dependency — `ColorWheel` is hand-rolled CSS/SVG + pointer events, no color-picker library (explicit non-goal in the spec).
- No raw `exposes` JSON sent to the frontend — API contract stays flat fields (`supportsColor`, `hue`, `saturation`, `colorMode`).

---

I have sufficient context. Producing the plan now.

### Task 1: Flyway migration + schema.sql resnapshot for exposes/hue/saturation columns

**Files:**
- Create: `backend/src/main/resources/db/migration/V1.9.0__Add_Device_Exposes_And_Color_Columns.sql`
- Modify: `backend-python/schema.sql:12-27` (extend `device` CREATE TABLE)
- Test: `backend-python/tests/test_device_schema_columns.py`

**Interfaces:**
- Consumes: nothing (bottom of the stack).
- Produces: three new nullable `device` columns — `exposes JSONB`, `hue SMALLINT`, `saturation SMALLINT` — available to every subsequent task that uses `Device`.

- [ ] **Step 1: Write the failing test**
```python
# backend-python/tests/test_device_schema_columns.py
"""Guards the V1.9.0 schema addition: exposes/hue/saturation columns on `device`."""

from sqlalchemy import text

from app.db import read_session


def test_device_table_has_exposes_hue_saturation_columns():
    with read_session() as session:
        rows = session.execute(
            text(
                "SELECT column_name, data_type FROM information_schema.columns "
                "WHERE table_name = 'device' "
                "AND column_name IN ('exposes', 'hue', 'saturation') "
                "ORDER BY column_name"
            )
        ).all()

    assert [(r[0], r[1]) for r in rows] == [
        ("exposes", "jsonb"),
        ("hue", "smallint"),
        ("saturation", "smallint"),
    ]
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd /Users/jakub/smart-home-core/backend-python && pytest tests/test_device_schema_columns.py -x`
Expected: FAIL with assertion showing an empty result (columns missing).

- [ ] **Step 3: Write minimal implementation**

Create `backend/src/main/resources/db/migration/V1.9.0__Add_Device_Exposes_And_Color_Columns.sql`:
```sql
ALTER TABLE device ADD COLUMN exposes JSONB;
ALTER TABLE device ADD COLUMN hue SMALLINT;
ALTER TABLE device ADD COLUMN saturation SMALLINT;
```

Extend the `device` CREATE TABLE in `backend-python/schema.sql` (currently lines 13-27) — replace the final three column lines with:
```sql
CREATE TABLE device (
    id BIGSERIAL PRIMARY KEY,
    ieee_address VARCHAR(24) NOT NULL UNIQUE,
    friendly_name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'OTHER',
    vendor VARCHAR(255),
    model VARCHAR(255),
    available BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    state VARCHAR(10),
    brightness SMALLINT,
    color_temp SMALLINT,
    exposes JSONB,
    hue SMALLINT,
    saturation SMALLINT
);
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd /Users/jakub/smart-home-core/backend-python && pytest tests/test_device_schema_columns.py -x`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add backend/src/main/resources/db/migration/V1.9.0__Add_Device_Exposes_And_Color_Columns.sql backend-python/schema.sql backend-python/tests/test_device_schema_columns.py
git commit -m "$(cat <<'EOF'
feat(db): add exposes/hue/saturation columns to device (V1.9.0)

Nullable JSONB `exposes` stores the raw Z2M capability array; `hue`
(0-360) and `saturation` (0-100) mirror `brightness`/`color_temp` as
device-only state read back from `zigbee2mqtt/<name>` telemetry.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: SQLAlchemy model columns

**Files:**
- Modify: `backend-python/app/device/models.py:4,22-37`
- Test: `backend-python/tests/test_device_repository.py` (add a new test alongside existing ones)

**Interfaces:**
- Consumes: Task 1's `device` table columns (`exposes JSONB`, `hue SMALLINT`, `saturation SMALLINT`).
- Produces: `Device.exposes: Mapped[dict | list | None]`, `Device.hue: Mapped[int | None]`, `Device.saturation: Mapped[int | None]` — persistable through the existing `device_repository`.

- [ ] **Step 1: Write the failing test**

Append to `backend-python/tests/test_device_repository.py`:
```python
def test_save_and_load_exposes_hue_saturation_round_trip():
    from app.db import read_session, transaction
    from app.device.models import Device, DeviceType
    from app.device.repository import device_repository

    exposes = [
        {
            "type": "light",
            "features": [
                {"name": "brightness", "type": "numeric"},
                {"name": "color_temp", "type": "numeric", "value_min": 153, "value_max": 500},
                {
                    "type": "composite",
                    "name": "color_hs",
                    "features": [
                        {"name": "hue", "type": "numeric"},
                        {"name": "saturation", "type": "numeric"},
                    ],
                },
            ],
        }
    ]
    with transaction() as session:
        device_repository.save(
            Device(
                ieee_address="00:11:22:33:44:55:66:AB",
                friendly_name="rgb_bulb",
                type=DeviceType.LIGHT.value,
                available=True,
                exposes=exposes,
                hue=200,
                saturation=80,
            ),
            session,
        )

    with read_session() as session:
        loaded = device_repository.find_by_ieee_address("00:11:22:33:44:55:66:AB", session)
    assert loaded.hue == 200
    assert loaded.saturation == 80
    assert loaded.exposes == exposes
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd /Users/jakub/smart-home-core/backend-python && pytest tests/test_device_repository.py::test_save_and_load_exposes_hue_saturation_round_trip -x`
Expected: FAIL with `TypeError: 'exposes' is an invalid keyword argument for Device` (or equivalent — model does not know the columns).

- [ ] **Step 3: Write minimal implementation**

Edit `backend-python/app/device/models.py`. Change the import line 4 to:
```python
from sqlalchemy import BigInteger, Boolean, DateTime, SmallInteger, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
```

Append three columns after `color_temp` (currently the last mapped_column in `Device`, line 37):
```python
    exposes: Mapped[list | dict | None] = mapped_column(JSONB)
    hue: Mapped[int | None] = mapped_column(SmallInteger)
    saturation: Mapped[int | None] = mapped_column(SmallInteger)
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd /Users/jakub/smart-home-core/backend-python && pytest tests/test_device_repository.py::test_save_and_load_exposes_hue_saturation_round_trip -x`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add backend-python/app/device/models.py backend-python/tests/test_device_repository.py
git commit -m "$(cat <<'EOF'
feat(device): map exposes JSONB and hue/saturation columns on Device

First JSONB use in the port; imported from sqlalchemy.dialects.postgresql
so we get the native jsonb type rather than the generic JSON one.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Z2MDevicePayload.exposes field + z2m_mapper persists verbatim

**Files:**
- Modify: `backend-python/app/device/schemas.py:60-68`
- Modify: `backend-python/app/device/z2m_mapper.py:37-56`
- Test: `backend-python/tests/test_z2m_mapper.py` (append new tests)

**Interfaces:**
- Consumes: `Device.exposes` column from Task 2, `Z2MDevicePayload` schema.
- Produces: `Z2MDevicePayload.exposes: list[dict] | None`, and `to_entity`/`update_entity_from_payload` write `payload.exposes` verbatim into `Device.exposes`.

- [ ] **Step 1: Write the failing test**

Append to `backend-python/tests/test_z2m_mapper.py`:
```python
RGB_BULB_EXPOSES = [
    {
        "type": "light",
        "features": [
            {"name": "brightness", "type": "numeric", "value_min": 0, "value_max": 254},
            {"name": "color_temp", "type": "numeric", "value_min": 153, "value_max": 500},
            {
                "type": "composite",
                "name": "color_hs",
                "features": [
                    {"name": "hue", "type": "numeric", "value_min": 0, "value_max": 360},
                    {"name": "saturation", "type": "numeric", "value_min": 0, "value_max": 100},
                ],
            },
        ],
    }
]


def test_to_entity_persists_exposes_verbatim():
    entity = z2m_mapper.to_entity(payload("Hue color bulb", exposes=RGB_BULB_EXPOSES))
    assert entity.exposes == RGB_BULB_EXPOSES


def test_update_entity_from_payload_overwrites_exposes():
    existing = Device(
        ieee_address="00:11:22:33:44:55",
        friendly_name="old",
        type=DeviceType.LIGHT.value,
        available=True,
        exposes=[{"stale": True}],
    )
    z2m_mapper.update_entity_from_payload(
        payload("Hue color bulb", friendly_name="new", exposes=RGB_BULB_EXPOSES), existing
    )
    assert existing.exposes == RGB_BULB_EXPOSES


def test_to_entity_without_exposes_leaves_column_null():
    entity = z2m_mapper.to_entity(payload("Motion sensor"))
    assert entity.exposes is None
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd /Users/jakub/smart-home-core/backend-python && pytest tests/test_z2m_mapper.py -x`
Expected: FAIL — `Z2MDevicePayload` rejects the unknown `exposes` field, or `Device.exposes` is `None` after the mapping.

- [ ] **Step 3: Write minimal implementation**

In `backend-python/app/device/schemas.py`, replace the `Z2MDevicePayload` class (lines 60-68) with:
```python
class Z2MDevicePayload(BaseModel):
    ieee_address: str | None = None
    friendly_name: str | None = None
    type: str | None = None
    vendor: str | None = None
    model: str | None = None
    definition: Z2MDefinition | None = None
    exposes: list[dict] | None = None

    model_config = ConfigDict(protected_namespaces=())
```

In `backend-python/app/device/z2m_mapper.py`, replace `to_entity` (lines 37-46) and `update_entity_from_payload` (lines 49-56) with:
```python
def to_entity(payload: Z2MDevicePayload) -> Device:
    return Device(
        ieee_address=payload.ieee_address,
        friendly_name=payload.friendly_name,
        type=determine_type(payload).value,
        vendor=resolve_vendor(payload),
        model=resolve_model(payload),
        available=True,
        last_seen=datetime.now(timezone.utc),
        exposes=payload.exposes,
    )


def update_entity_from_payload(payload: Z2MDevicePayload, device: Device) -> None:
    # availability/lastSeen are owned by the zigbee2mqtt/+/availability topic,
    # not by device sync — do not touch them here.
    device.friendly_name = payload.friendly_name
    device.type = determine_type(payload).value
    device.vendor = resolve_vendor(payload)
    device.model = resolve_model(payload)
    device.exposes = payload.exposes
    device.updated_at = datetime.now(timezone.utc)
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd /Users/jakub/smart-home-core/backend-python && pytest tests/test_z2m_mapper.py -x`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add backend-python/app/device/schemas.py backend-python/app/device/z2m_mapper.py backend-python/tests/test_z2m_mapper.py
git commit -m "$(cat <<'EOF'
feat(device): capture Z2M `exposes` array verbatim on sync

The mapper now writes the raw exposes list into Device.exposes on both
insert and update. No interpretation happens at ingest — capability
questions are answered at read time.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: supportsColor capability helper

**Files:**
- Create: `backend-python/app/device/capabilities.py`
- Test: `backend-python/tests/test_device_capabilities.py`

**Interfaces:**
- Consumes: The `exposes` JSON shape stored by Task 3 (an array of expose entries; `light` composites nest their sub-features under a `features` array).
- Produces: `supports_color(exposes: list | dict | None) -> bool` — returns `True` iff a `color_hs` feature is present anywhere in the nested `features` tree; `False` for `None`, empty, or color-temp-only devices.

- [ ] **Step 1: Write the failing test**
```python
# backend-python/tests/test_device_capabilities.py
"""Guards derivation of supportsColor from the raw Z2M exposes JSON."""

from app.device.capabilities import supports_color

RGB_BULB_EXPOSES = [
    {
        "type": "light",
        "features": [
            {"name": "state", "type": "binary"},
            {"name": "brightness", "type": "numeric", "value_min": 0, "value_max": 254},
            {"name": "color_temp", "type": "numeric", "value_min": 153, "value_max": 500},
            {
                "type": "composite",
                "name": "color_hs",
                "features": [
                    {"name": "hue", "type": "numeric", "value_min": 0, "value_max": 360},
                    {"name": "saturation", "type": "numeric", "value_min": 0, "value_max": 100},
                ],
            },
        ],
    }
]

RGB_LED_STRIP_EXPOSES = [
    {
        "type": "light",
        "features": [
            {"name": "state", "type": "binary"},
            {"name": "brightness", "type": "numeric", "value_min": 0, "value_max": 254},
            {
                "type": "composite",
                "name": "color_hs",
                "features": [
                    {"name": "hue", "type": "numeric", "value_min": 0, "value_max": 360},
                    {"name": "saturation", "type": "numeric", "value_min": 0, "value_max": 100},
                ],
            },
        ],
    },
    {"name": "linkquality", "type": "numeric"},
]

COLOR_TEMP_ONLY_EXPOSES = [
    {
        "type": "light",
        "features": [
            {"name": "state", "type": "binary"},
            {"name": "brightness", "type": "numeric", "value_min": 0, "value_max": 254},
            {"name": "color_temp", "type": "numeric", "value_min": 153, "value_max": 500},
        ],
    }
]


def test_supports_color_true_for_rgb_bulb():
    assert supports_color(RGB_BULB_EXPOSES) is True


def test_supports_color_true_for_rgb_led_strip():
    assert supports_color(RGB_LED_STRIP_EXPOSES) is True


def test_supports_color_false_for_color_temp_only_bulb():
    assert supports_color(COLOR_TEMP_ONLY_EXPOSES) is False


def test_supports_color_false_for_none():
    assert supports_color(None) is False


def test_supports_color_false_for_empty_list():
    assert supports_color([]) is False


def test_supports_color_false_for_sensor_without_light_expose():
    exposes = [
        {"name": "temperature", "type": "numeric"},
        {"name": "humidity", "type": "numeric"},
    ]
    assert supports_color(exposes) is False


def test_supports_color_ignores_color_xy_only():
    exposes = [
        {
            "type": "light",
            "features": [
                {
                    "type": "composite",
                    "name": "color_xy",
                    "features": [
                        {"name": "x", "type": "numeric"},
                        {"name": "y", "type": "numeric"},
                    ],
                }
            ],
        }
    ]
    assert supports_color(exposes) is False
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd /Users/jakub/smart-home-core/backend-python && pytest tests/test_device_capabilities.py -x`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.device.capabilities'`.

- [ ] **Step 3: Write minimal implementation**

Create `backend-python/app/device/capabilities.py`:
```python
"""Read-time interpretation of the raw Z2M `exposes` JSON stored on Device."""

from typing import Any


def supports_color(exposes: Any) -> bool:
    """True iff the exposes tree names a `color_hs` feature anywhere.

    Zigbee2MQTT's schema for a color bulb nests hue/saturation inside a
    `color_hs` composite, which itself lives under a `light` expose's
    `features` array. `color_xy` is deliberately excluded — this codebase
    only sends `{"color":{"hue","saturation"}}`.
    """
    if not exposes:
        return False
    return _walk(exposes)


def _walk(node: Any) -> bool:
    if isinstance(node, list):
        return any(_walk(item) for item in node)
    if isinstance(node, dict):
        if node.get("name") == "color_hs":
            return True
        features = node.get("features")
        if features and _walk(features):
            return True
    return False
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd /Users/jakub/smart-home-core/backend-python && pytest tests/test_device_capabilities.py -x`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add backend-python/app/device/capabilities.py backend-python/tests/test_device_capabilities.py
git commit -m "$(cat <<'EOF'
feat(device): derive supportsColor from stored exposes JSON

Walks the nested Z2M exposes tree looking for a color_hs feature.
color_xy is deliberately not treated as color support — the app only
publishes {\"color\":{\"hue\",\"saturation\"}} commands.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: DeviceResponse exposes hue/saturation/colorMode/supportsColor

**Files:**
- Modify: `backend-python/app/device/models.py` (add `color_mode` column mapping — see note below)
- Modify: `backend-python/app/device/schemas.py:9-25`
- Modify: `backend-python/app/device/mappers.py:7-22`
- Test: `backend-python/tests/test_device_api.py` (append)

Note: `color_mode` is written by task 8 into a new `color_mode` DB column. Add that column here (small piggyback on task 1's migration only if not shipped; otherwise piggyback on a Task-1 amendment). To keep tasks independent, this task stores `color_mode` in the `state` VARCHAR-independent way by adding a `color_mode VARCHAR(20)` column at the schema level too — but per the spec we resolve this by making `colorMode` derived from the *last-reported* value that task 8 will persist. Simpler: add `color_mode` alongside `hue`/`saturation` in Task 1's migration. Amend Task 1's migration and schema.sql before proceeding:

Amend `backend/src/main/resources/db/migration/V1.9.0__Add_Device_Exposes_And_Color_Columns.sql` to also include `ALTER TABLE device ADD COLUMN color_mode VARCHAR(20);`, and add `color_mode VARCHAR(20)` in `backend-python/schema.sql`'s `device` block. Also add `color_mode: Mapped[str | None] = mapped_column(String(20))` in `models.py`. (If Task 1 is already committed, amend via a fixup or a follow-on file `V1.9.1__Add_Device_Color_Mode_Column.sql` — pick fixup unless already pushed.)

**Interfaces:**
- Consumes: `Device.exposes`, `Device.hue`, `Device.saturation`, `Device.color_mode`; `supports_color()` from Task 4.
- Produces: `DeviceResponse` fields `hue: int | None`, `saturation: int | None`, `colorMode: str | None`, `supportsColor: bool` — consumed by the frontend in Task 9.

- [ ] **Step 1: Write the failing test**

Append to `backend-python/tests/test_device_api.py`:
```python
def test_get_device_by_id_includes_color_fields_defaults(client, seeded_device_id):
    body = client.get(f"/api/devices/{seeded_device_id}").json()
    assert body["hue"] is None
    assert body["saturation"] is None
    assert body["colorMode"] is None
    # sensor with no exposes -> supportsColor False, not null
    assert body["supportsColor"] is False


def test_get_device_by_id_derives_supports_color_from_exposes(client):
    from app.db import transaction
    from app.device.models import Device, DeviceType
    from app.device.repository import device_repository

    with transaction() as session:
        device = Device(
            ieee_address="AA:BB:CC:DD:EE:FF:00:22",
            friendly_name="rgb_bulb",
            type=DeviceType.LIGHT.value,
            available=True,
            hue=120,
            saturation=75,
            color_mode="hs",
            exposes=[
                {
                    "type": "light",
                    "features": [
                        {
                            "type": "composite",
                            "name": "color_hs",
                            "features": [
                                {"name": "hue", "type": "numeric"},
                                {"name": "saturation", "type": "numeric"},
                            ],
                        }
                    ],
                }
            ],
        )
        device_repository.save(device, session)
        session.flush()
        device_id = device.id

    body = client.get(f"/api/devices/{device_id}").json()
    assert body["hue"] == 120
    assert body["saturation"] == 75
    assert body["colorMode"] == "hs"
    assert body["supportsColor"] is True
    assert "exposes" not in body
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd /Users/jakub/smart-home-core/backend-python && pytest tests/test_device_api.py::test_get_device_by_id_includes_color_fields_defaults tests/test_device_api.py::test_get_device_by_id_derives_supports_color_from_exposes -x`
Expected: FAIL — `KeyError: 'hue'` (or similar), fields missing from response.

- [ ] **Step 3: Write minimal implementation**

Add `color_mode` column: amend `V1.9.0__Add_Device_Exposes_And_Color_Columns.sql` and `schema.sql` (append `color_mode VARCHAR(20)` in the `device` CREATE TABLE); add to `models.py`:
```python
    color_mode: Mapped[str | None] = mapped_column(String(20))
```

Edit `backend-python/app/device/schemas.py` — replace `DeviceResponse` (lines 9-25) with:
```python
class DeviceResponse(BaseModel):
    id: int
    ieeeAddress: str
    friendlyName: str
    type: DeviceType
    vendor: str | None
    model: str | None
    available: bool
    lastSeen: OffsetDateTime | None
    createdAt: OffsetDateTime
    updatedAt: OffsetDateTime
    state: str | None
    brightness: int | None
    colorTemp: int | None
    hue: int | None
    saturation: int | None
    colorMode: str | None
    supportsColor: bool

    # 'model' collides with Pydantic's protected namespace, which is only a warning.
    model_config = ConfigDict(protected_namespaces=())
```

Edit `backend-python/app/device/mappers.py` — replace `to_response` (lines 7-22) with:
```python
from app.device.capabilities import supports_color
from app.device.models import Device
from app.device.schemas import DeviceResponse


def to_response(device: Device) -> DeviceResponse:
    return DeviceResponse(
        id=device.id,
        ieeeAddress=device.ieee_address,
        friendlyName=device.friendly_name,
        type=device.type,
        vendor=device.vendor,
        model=device.model,
        available=device.available,
        lastSeen=device.last_seen,
        createdAt=device.created_at,
        updatedAt=device.updated_at,
        state=device.state,
        brightness=device.brightness,
        colorTemp=device.color_temp,
        hue=device.hue,
        saturation=device.saturation,
        colorMode=device.color_mode,
        supportsColor=supports_color(device.exposes),
    )
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd /Users/jakub/smart-home-core/backend-python && pytest tests/test_device_api.py -x`
Expected: PASS (both new tests and all existing device API tests).

- [ ] **Step 5: Commit**
```bash
git add backend/src/main/resources/db/migration/V1.9.0__Add_Device_Exposes_And_Color_Columns.sql backend-python/schema.sql backend-python/app/device/models.py backend-python/app/device/schemas.py backend-python/app/device/mappers.py backend-python/tests/test_device_api.py
git commit -m "$(cat <<'EOF'
feat(device): expose hue/saturation/colorMode/supportsColor on DeviceResponse

supportsColor is derived from the stored exposes JSON at mapping time
and always present as a bool (False rather than null for non-color
devices). The raw exposes column stays backend-only. Adds a
`color_mode VARCHAR(20)` column so the last-reported mode from Z2M can
be reflected back to the UI.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: command_service.set_color

**Files:**
- Modify: `backend-python/app/device/command_service.py:12-33`
- Test: `backend-python/tests/test_device_command_service.py` (create) OR extend existing device API tests (this task tests the service in isolation).

**Interfaces:**
- Consumes: `mqtt_publisher.publish(topic, body, qos, retain)`.
- Produces: `DeviceCommandService.set_color(self, friendly_name: str, hue: int, saturation: int) -> None` — publishes `{"color": {"hue": <h>, "saturation": <s>}}` to `zigbee2mqtt/<name>/set` at qos=1, retain=False.

- [ ] **Step 1: Write the failing test**
```python
# backend-python/tests/test_device_command_service.py
"""Unit-tests for DeviceCommandService.set_color — mirrors the wire shape
that the existing set_brightness/set_color_temp tests assert in test_device_api.py."""

import pytest

from app.device.command_service import device_command_service


@pytest.fixture
def published(monkeypatch) -> list[tuple[str, bytes]]:
    sent: list[tuple[str, bytes]] = []
    monkeypatch.setattr(
        "app.mqtt.publisher.mqtt_publisher.publish",
        lambda topic, payload, qos=1, retain=False: sent.append((topic, payload)),
    )
    return sent


def test_set_color_publishes_hue_and_saturation(published):
    device_command_service.set_color("living_room_light", 200, 80)
    assert published == [
        ("zigbee2mqtt/living_room_light/set", b'{"color":{"hue":200,"saturation":80}}')
    ]


def test_set_color_uses_compact_json(published):
    device_command_service.set_color("bulb", 0, 0)
    _, body = published[0]
    assert b" " not in body
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd /Users/jakub/smart-home-core/backend-python && pytest tests/test_device_command_service.py -x`
Expected: FAIL — `AttributeError: 'DeviceCommandService' object has no attribute 'set_color'`.

- [ ] **Step 3: Write minimal implementation**

Insert into `backend-python/app/device/command_service.py` after `set_color_temp` (line 20):
```python
    def set_color(self, friendly_name: str, hue: int, saturation: int) -> None:
        self._send(friendly_name, {"color": {"hue": hue, "saturation": saturation}})
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd /Users/jakub/smart-home-core/backend-python && pytest tests/test_device_command_service.py -x`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add backend-python/app/device/command_service.py backend-python/tests/test_device_command_service.py
git commit -m "$(cat <<'EOF'
feat(device): add DeviceCommandService.set_color

Publishes {\"color\":{\"hue\",\"saturation\"}} on zigbee2mqtt/<name>/set
via the same _send helper as the other typed commands, inheriting its
qos=1/non-retained/error-logging behaviour.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: router.py setColor branch with hue/saturation validation

**Files:**
- Modify: `backend-python/app/device/router.py:92-114`
- Test: `backend-python/tests/test_device_api.py` (append)

**Interfaces:**
- Consumes: `device_command_service.set_color(friendly_name, hue, saturation)` from Task 6, `BadRequestError` from `app.common.exceptions`.
- Produces: `POST /api/devices/{id}/command` accepts `{"command":"setColor","payload":{"hue":H,"saturation":S}}`, returning 202 on success and 400 (JSON `{"title":"Bad Request","detail":..., "status":400}`) when either field is missing or out of range (hue 0-360, saturation 0-100).

- [ ] **Step 1: Write the failing test**

Append to `backend-python/tests/test_device_api.py`:
```python
def test_set_color_returns_202(client, seeded_device_id, published):
    response = client.post(
        f"/api/devices/{seeded_device_id}/command",
        json={"command": "setColor", "payload": {"hue": 200, "saturation": 80}},
    )
    assert response.status_code == 202
    assert published == [
        (
            "zigbee2mqtt/Living Room Sensor/set",
            b'{"color":{"hue":200,"saturation":80}}',
        )
    ]


def test_set_color_missing_hue_returns_400(client, seeded_device_id, published):
    response = client.post(
        f"/api/devices/{seeded_device_id}/command",
        json={"command": "setColor", "payload": {"saturation": 80}},
    )
    assert response.status_code == 400
    body = response.json()
    assert body["title"] == "Bad Request"
    assert "hue" in body["detail"]
    assert published == []


def test_set_color_missing_saturation_returns_400(client, seeded_device_id, published):
    response = client.post(
        f"/api/devices/{seeded_device_id}/command",
        json={"command": "setColor", "payload": {"hue": 200}},
    )
    assert response.status_code == 400
    assert "saturation" in response.json()["detail"]


def test_set_color_hue_out_of_range_returns_400(client, seeded_device_id, published):
    response = client.post(
        f"/api/devices/{seeded_device_id}/command",
        json={"command": "setColor", "payload": {"hue": 400, "saturation": 50}},
    )
    assert response.status_code == 400
    assert "hue" in response.json()["detail"]
    assert published == []


def test_set_color_negative_hue_returns_400(client, seeded_device_id, published):
    response = client.post(
        f"/api/devices/{seeded_device_id}/command",
        json={"command": "setColor", "payload": {"hue": -1, "saturation": 50}},
    )
    assert response.status_code == 400


def test_set_color_saturation_out_of_range_returns_400(client, seeded_device_id, published):
    response = client.post(
        f"/api/devices/{seeded_device_id}/command",
        json={"command": "setColor", "payload": {"hue": 200, "saturation": 101}},
    )
    assert response.status_code == 400
    assert "saturation" in response.json()["detail"]
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd /Users/jakub/smart-home-core/backend-python && pytest tests/test_device_api.py -k set_color -x`
Expected: FAIL — first test returns 400 with `"Unknown command: 'setColor'"`, because the branch does not exist.

- [ ] **Step 3: Write minimal implementation**

Edit `backend-python/app/device/router.py` — replace `_route_command` (lines 92-109) with:
```python
def _route_command(friendly_name: str, request: DeviceCommandRequest) -> None:
    payload = request.payload

    if request.command == "setState":
        _require_field(payload, "state")
        device_command_service.set_state(friendly_name, _as_text(payload["state"]))
    elif request.command == "setBrightness":
        _require_field(payload, "brightness")
        device_command_service.set_brightness(friendly_name, _as_int(payload["brightness"]))
    elif request.command == "setColorTemp":
        _require_field(payload, "color_temp")
        device_command_service.set_color_temp(friendly_name, _as_int(payload["color_temp"]))
    elif request.command == "setColor":
        _require_field(payload, "hue")
        _require_field(payload, "saturation")
        hue = _as_int(payload["hue"])
        saturation = _as_int(payload["saturation"])
        if hue < 0 or hue > 360:
            raise BadRequestError(f"'hue' must be between 0 and 360 (got {hue})")
        if saturation < 0 or saturation > 100:
            raise BadRequestError(
                f"'saturation' must be between 0 and 100 (got {saturation})"
            )
        device_command_service.set_color(friendly_name, hue, saturation)
    elif request.command == "raw":
        if payload is None:
            raise BadRequestError("payload is required for 'raw' command")
        device_command_service.send_raw_command(friendly_name, payload)
    else:
        raise BadRequestError(f"Unknown command: '{request.command}'")
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd /Users/jakub/smart-home-core/backend-python && pytest tests/test_device_api.py -x`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add backend-python/app/device/router.py backend-python/tests/test_device_api.py
git commit -m "$(cat <<'EOF'
feat(device): route setColor command with hue/saturation validation

hue is clamped to 0-360, saturation to 0-100; violations raise
BadRequestError, producing the same {\"title\":\"Bad Request\",...}
shape as the existing setBrightness/setColorTemp checks.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: consumers.py reads color.hue/color.saturation/color_mode back into DB

**Files:**
- Modify: `backend-python/app/mqtt/consumers.py:76-84`
- Modify: `backend-python/app/device/service.py:86-94` (extend `update_light_state`)
- Modify: `backend-python/app/device/repository.py:104-115` (extend `update_light_state_by_ieee`)
- Test: `backend-python/tests/test_mqtt_consumers.py` (append)

**Interfaces:**
- Consumes: `Device.hue`, `Device.saturation`, `Device.color_mode` columns.
- Produces: `device_service.update_light_state(ieee_address, *, brightness=None, color_temp=None, hue=None, saturation=None, color_mode=None) -> None` — updates only the columns whose kwargs are not `None`.

- [ ] **Step 1: Write the failing test**

Append to `backend-python/tests/test_mqtt_consumers.py`:
```python
def test_consume_telemetry_writes_color_hue_saturation_and_mode_to_postgres(written):
    with transaction() as session:
        device_repository.save(
            Device(
                ieee_address="00:11:22:33:44:55:66:EE",
                friendly_name="rgb_bulb",
                type=DeviceType.LIGHT.value,
                available=True,
            ),
            session,
        )

    consumers.consume_telemetry(
        "zigbee2mqtt/rgb_bulb",
        _encode({"color": {"hue": 200, "saturation": 80}, "color_mode": "hs"}),
    )

    # color fields never reach InfluxDB
    assert written == []

    with read_session() as session:
        device = device_repository.find_by_ieee_address("00:11:22:33:44:55:66:EE", session)
    assert device.hue == 200
    assert device.saturation == 80
    assert device.color_mode == "hs"


def test_consume_telemetry_partial_color_update_does_not_clobber_brightness_or_temp(written):
    with transaction() as session:
        device_repository.save(
            Device(
                ieee_address="00:11:22:33:44:55:66:FE",
                friendly_name="rgb_bulb_2",
                type=DeviceType.LIGHT.value,
                available=True,
                brightness=100,
                color_temp=300,
            ),
            session,
        )

    consumers.consume_telemetry(
        "zigbee2mqtt/rgb_bulb_2", _encode({"color": {"hue": 10, "saturation": 90}})
    )

    with read_session() as session:
        device = device_repository.find_by_ieee_address("00:11:22:33:44:55:66:FE", session)
    assert device.brightness == 100
    assert device.color_temp == 300
    assert device.hue == 10
    assert device.saturation == 90


def test_consume_telemetry_color_mode_only_update(written):
    with transaction() as session:
        device_repository.save(
            Device(
                ieee_address="00:11:22:33:44:55:66:FF",
                friendly_name="rgb_bulb_3",
                type=DeviceType.LIGHT.value,
                available=True,
            ),
            session,
        )

    consumers.consume_telemetry(
        "zigbee2mqtt/rgb_bulb_3", _encode({"color_mode": "color_temp"})
    )

    with read_session() as session:
        device = device_repository.find_by_ieee_address("00:11:22:33:44:55:66:FF", session)
    assert device.color_mode == "color_temp"
    assert device.hue is None
    assert device.saturation is None


def test_consume_telemetry_non_dict_color_field_is_ignored(written):
    with transaction() as session:
        device_repository.save(
            Device(
                ieee_address="00:11:22:33:44:55:66:AC",
                friendly_name="weird_bulb",
                type=DeviceType.LIGHT.value,
                available=True,
            ),
            session,
        )

    consumers.consume_telemetry("zigbee2mqtt/weird_bulb", _encode({"color": "red"}))

    with read_session() as session:
        device = device_repository.find_by_ieee_address("00:11:22:33:44:55:66:AC", session)
    assert device.hue is None
    assert device.saturation is None
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd /Users/jakub/smart-home-core/backend-python && pytest tests/test_mqtt_consumers.py -k color -x`
Expected: FAIL — `device.hue` remains `None`; consumer discards the fields.

- [ ] **Step 3: Write minimal implementation**

Edit `backend-python/app/device/repository.py` — replace `update_light_state_by_ieee` (lines 104-115) with:
```python
    def update_light_state_by_ieee(
        self,
        ieee_address: str,
        *,
        brightness: int | None = None,
        color_temp: int | None = None,
        hue: int | None = None,
        saturation: int | None = None,
        color_mode: str | None = None,
        session: Session,
    ) -> int:
        values: dict = {"updated_at": datetime.now(timezone.utc)}
        if brightness is not None:
            values["brightness"] = brightness
        if color_temp is not None:
            values["color_temp"] = color_temp
        if hue is not None:
            values["hue"] = hue
        if saturation is not None:
            values["saturation"] = saturation
        if color_mode is not None:
            values["color_mode"] = color_mode
        if len(values) == 1:
            return 0
        result = session.execute(update(Device).where(Device.ieee_address == ieee_address).values(**values))
        return result.rowcount
```

Edit `backend-python/app/device/service.py` — replace `update_light_state` (lines 86-94) with:
```python
    def update_light_state(
        self,
        ieee_address: str,
        *,
        brightness: int | None = None,
        color_temp: int | None = None,
        hue: int | None = None,
        saturation: int | None = None,
        color_mode: str | None = None,
    ) -> None:
        if all(
            v is None
            for v in (brightness, color_temp, hue, saturation, color_mode)
        ):
            return
        with transaction() as session:
            updated = device_repository.update_light_state_by_ieee(
                ieee_address,
                brightness=brightness,
                color_temp=color_temp,
                hue=hue,
                saturation=saturation,
                color_mode=color_mode,
                session=session,
            )
        if updated == 0:
            log.debug("Light state update for unknown device '%s' ignored", ieee_address)
```

Edit `backend-python/app/mqtt/consumers.py` — replace the brightness/color_temp block (lines 76-84) with:
```python
    brightness = _as_optional_int(parsed.get("brightness"))
    color_temp = _as_optional_int(parsed.get("color_temp"))
    color = parsed.get("color") if isinstance(parsed.get("color"), dict) else None
    hue = _as_optional_int(color.get("hue")) if color else None
    saturation = _as_optional_int(color.get("saturation")) if color else None
    color_mode = parsed.get("color_mode") if isinstance(parsed.get("color_mode"), str) else None
    if identity is not None and any(
        v is not None for v in (brightness, color_temp, hue, saturation, color_mode)
    ):
        try:
            device_service.update_light_state(
                identity.ieee_address,
                brightness=brightness,
                color_temp=color_temp,
                hue=hue,
                saturation=saturation,
                color_mode=color_mode,
            )
        except Exception as e:
            log.error("Failed to update light state for %s: %s", device_name, e)
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd /Users/jakub/smart-home-core/backend-python && pytest tests/test_mqtt_consumers.py -x`
Expected: PASS (new tests plus all existing telemetry tests).

- [ ] **Step 5: Commit**
```bash
git add backend-python/app/mqtt/consumers.py backend-python/app/device/service.py backend-python/app/device/repository.py backend-python/tests/test_mqtt_consumers.py
git commit -m "$(cat <<'EOF'
feat(mqtt): read color.hue/color.saturation/color_mode back into Postgres

Extends update_light_state / update_light_state_by_ieee with hue,
saturation and color_mode kwargs; partial updates leave the other
columns untouched, matching the existing brightness/color_temp
behaviour. Non-dict `color` values and non-string `color_mode` values
are silently ignored.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Frontend types — Device fields and DeviceCommandRequest.setColor

**Files:**
- Modify: `frontend/src/modules/devices/types/device.ts:3-22`
- Test: no dedicated test — this is a pure type change consumed by Tasks 10 and 11's tests; a TS compile check via existing `npm test` (which runs vitest with `tsc` via Vite's transform) proves the shape.

**Interfaces:**
- Consumes: nothing.
- Produces: `Device.hue?: number | null`, `Device.saturation?: number | null`, `Device.colorMode?: string | null`, `Device.supportsColor?: boolean`; `DeviceCommandRequest['command']` union gains `'setColor'`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/devices/types/device.test.ts`:
```ts
import { describe, expectTypeOf, it } from 'vitest'
import type { Device, DeviceCommandRequest } from './device'

describe('Device typings for color', () => {
  it('accepts hue/saturation/colorMode/supportsColor on Device', () => {
    const d: Device = {
      id: 1,
      ieeeAddress: '0x1',
      friendlyName: 'rgb',
      type: 'LIGHT',
      vendor: null,
      model: null,
      available: true,
      state: 'ON',
      brightness: 200,
      colorTemp: 320,
      hue: 200,
      saturation: 80,
      colorMode: 'hs',
      supportsColor: true,
      lastSeen: null,
      createdAt: '',
      updatedAt: '',
    }
    expectTypeOf(d.hue).toEqualTypeOf<number | null | undefined>()
    expectTypeOf(d.supportsColor).toEqualTypeOf<boolean | undefined>()
  })

  it("accepts 'setColor' as a DeviceCommandRequest command", () => {
    const req: DeviceCommandRequest = {
      command: 'setColor',
      payload: { hue: 200, saturation: 80 },
    }
    expectTypeOf(req.command).toEqualTypeOf<
      'setState' | 'setBrightness' | 'setColorTemp' | 'setColor' | 'raw'
    >()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- src/modules/devices/types/device.test.ts`
Expected: FAIL — TypeScript rejects `hue`/`saturation`/`colorMode`/`supportsColor` on `Device` and rejects `'setColor'` in the command union.

- [ ] **Step 3: Write minimal implementation**

Replace `frontend/src/modules/devices/types/device.ts`:
```ts
export type DeviceType = 'LIGHT' | 'SENSOR' | 'SWITCH' | 'PLUG' | 'OTHER'

export interface Device {
  id: number
  ieeeAddress: string
  friendlyName: string
  type: DeviceType
  vendor: string | null
  model: string | null
  available: boolean
  state: 'ON' | 'OFF' | null
  brightness: number | null
  colorTemp: number | null
  hue?: number | null
  saturation?: number | null
  colorMode?: string | null
  supportsColor?: boolean
  lastSeen: string | null
  createdAt: string
  updatedAt: string
}

export interface DeviceCommandRequest {
  command: 'setState' | 'setBrightness' | 'setColorTemp' | 'setColor' | 'raw'
  payload: Record<string, unknown>
}

export interface UpdateDeviceRequest {
  friendlyName: string
  type: DeviceType
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- src/modules/devices/types/device.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/modules/devices/types/device.ts frontend/src/modules/devices/types/device.test.ts
git commit -m "$(cat <<'EOF'
feat(frontend): extend Device types with hue/saturation/colorMode/supportsColor

hue, saturation, colorMode and supportsColor are optional on Device so
existing test fixtures keep compiling; wire-shape parity with the
backend's DeviceResponse. setColor joins the DeviceCommandRequest union.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: ColorWheel component with pointer-math tests

**Files:**
- Create: `frontend/src/modules/devices/components/ColorWheel.tsx`
- Create: `frontend/src/modules/devices/components/ColorWheel.test.tsx`

**Interfaces:**
- Consumes: nothing from other tasks (leaf UI component).
- Produces: `ColorWheel` component
  ```ts
  interface ColorWheelProps {
    hue: number            // 0-360, current value
    saturation: number     // 0-100, current value
    disabled?: boolean
    onChange?: (hue: number, saturation: number) => void   // fires on drag
    onCommit: (hue: number, saturation: number) => void    // fires on release
  }
  ```
  Exposes a pure helper `positionToHueSaturation(dx: number, dy: number, radius: number): { hue: number; saturation: number }` for direct testing without simulating pointer events on jsdom.

- [ ] **Step 1: Write the failing test**
```tsx
// frontend/src/modules/devices/components/ColorWheel.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ColorWheel, positionToHueSaturation } from './ColorWheel'

describe('positionToHueSaturation', () => {
  const RADIUS = 100

  it('right of centre maps to hue 0, full saturation at the edge', () => {
    const { hue, saturation } = positionToHueSaturation(100, 0, RADIUS)
    expect(hue).toBe(0)
    expect(saturation).toBe(100)
  })

  it('below centre maps to hue 90', () => {
    const { hue } = positionToHueSaturation(0, 100, RADIUS)
    expect(hue).toBe(90)
  })

  it('left of centre maps to hue 180', () => {
    const { hue } = positionToHueSaturation(-100, 0, RADIUS)
    expect(hue).toBe(180)
  })

  it('above centre maps to hue 270', () => {
    const { hue } = positionToHueSaturation(0, -100, RADIUS)
    expect(hue).toBe(270)
  })

  it('centre maps to saturation 0', () => {
    const { saturation } = positionToHueSaturation(0, 0, RADIUS)
    expect(saturation).toBe(0)
  })

  it('half-radius maps to saturation 50', () => {
    const { saturation } = positionToHueSaturation(50, 0, RADIUS)
    expect(saturation).toBe(50)
  })

  it('clamps a pointer outside the circle to saturation 100', () => {
    const { hue, saturation } = positionToHueSaturation(200, 0, RADIUS)
    expect(hue).toBe(0)
    expect(saturation).toBe(100)
  })

  it('clamps an outside diagonal pointer to saturation 100 while preserving hue', () => {
    const { hue, saturation } = positionToHueSaturation(200, 200, RADIUS)
    expect(hue).toBe(45)
    expect(saturation).toBe(100)
  })

  it('normalises negative angles into 0-360', () => {
    const { hue } = positionToHueSaturation(1, -1, RADIUS)
    expect(hue).toBeGreaterThanOrEqual(0)
    expect(hue).toBeLessThan(360)
    expect(hue).toBe(315)
  })
})

describe('ColorWheel', () => {
  it('renders an accessible role="slider" wheel with the current values', () => {
    render(<ColorWheel hue={200} saturation={80} onCommit={vi.fn()} />)
    const wheel = screen.getByRole('slider', { name: /barva/i })
    expect(wheel).toHaveAttribute('aria-valuenow', '200')
    expect(wheel).toHaveAttribute('aria-valuemin', '0')
    expect(wheel).toHaveAttribute('aria-valuemax', '360')
  })

  it('marks itself aria-disabled when disabled', () => {
    render(<ColorWheel hue={0} saturation={0} disabled onCommit={vi.fn()} />)
    expect(screen.getByRole('slider', { name: /barva/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- src/modules/devices/components/ColorWheel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/modules/devices/components/ColorWheel.tsx`:
```tsx
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'

const SIZE = 200
const RADIUS = SIZE / 2

interface ColorWheelProps {
  hue: number
  saturation: number
  disabled?: boolean
  onChange?: (hue: number, saturation: number) => void
  onCommit: (hue: number, saturation: number) => void
}

/**
 * Pure pointer-math: pointer offset from the wheel centre (`dx`, `dy` in
 * pixels, +y downwards) mapped to hue (0-360, 0 = +x axis, growing clockwise
 * because +y is downwards) and saturation (0-100, radial distance from centre
 * clamped to the wheel edge).
 */
export function positionToHueSaturation(
  dx: number,
  dy: number,
  radius: number,
): { hue: number; saturation: number } {
  const distance = Math.sqrt(dx * dx + dy * dy)
  const saturationRaw = distance === 0 ? 0 : Math.min(1, distance / radius) * 100
  const saturation = Math.round(saturationRaw)
  if (distance === 0) {
    return { hue: 0, saturation }
  }
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI
  if (angle < 0) angle += 360
  return { hue: Math.round(angle) % 360, saturation }
}

function polarToCartesian(hue: number, saturation: number, radius: number) {
  const distance = (saturation / 100) * radius
  const rad = (hue * Math.PI) / 180
  return {
    x: radius + Math.cos(rad) * distance,
    y: radius + Math.sin(rad) * distance,
  }
}

export function ColorWheel({
  hue,
  saturation,
  disabled,
  onChange,
  onCommit,
}: ColorWheelProps) {
  const [localHue, setLocalHue] = useState(hue)
  const [localSaturation, setLocalSaturation] = useState(saturation)
  const draggingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!draggingRef.current) setLocalHue(hue)
  }, [hue])
  useEffect(() => {
    if (!draggingRef.current) setLocalSaturation(saturation)
  }, [saturation])

  const compute = (e: PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return null
    const dx = e.clientX - rect.left - RADIUS
    const dy = e.clientY - rect.top - RADIUS
    return positionToHueSaturation(dx, dy, RADIUS)
  }

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
    draggingRef.current = true
    const next = compute(e)
    if (next) {
      setLocalHue(next.hue)
      setLocalSaturation(next.saturation)
      onChange?.(next.hue, next.saturation)
    }
  }

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    const next = compute(e)
    if (next) {
      setLocalHue(next.hue)
      setLocalSaturation(next.saturation)
      onChange?.(next.hue, next.saturation)
    }
  }

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    const next = compute(e) ?? { hue: localHue, saturation: localSaturation }
    setLocalHue(next.hue)
    setLocalSaturation(next.saturation)
    onCommit(next.hue, next.saturation)
  }

  const thumb = polarToCartesian(localHue, localSaturation, RADIUS)
  const wheelStyle: CSSProperties = {
    width: SIZE,
    height: SIZE,
    background: `
      radial-gradient(circle at center, hsl(0 0% 100%) 0%, hsla(0, 0%, 100%, 0) 70%),
      conic-gradient(from 0deg,
        hsl(0 100% 50%),   hsl(60 100% 50%),  hsl(120 100% 50%),
        hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%),
        hsl(360 100% 50%))
    `,
    borderRadius: '50%',
    position: 'relative',
    touchAction: 'none',
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'crosshair',
  }
  const thumbStyle: CSSProperties = {
    position: 'absolute',
    left: thumb.x - 10,
    top: thumb.y - 10,
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: `hsl(${localHue} ${localSaturation}% 50%)`,
    border: '3px solid var(--surface, #fff)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
    pointerEvents: 'none',
  }

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label="Barva"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={localHue}
      aria-disabled={disabled ? 'true' : undefined}
      style={wheelStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div style={thumbStyle} />
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- src/modules/devices/components/ColorWheel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/modules/devices/components/ColorWheel.tsx frontend/src/modules/devices/components/ColorWheel.test.tsx
git commit -m "$(cat <<'EOF'
feat(devices): add hand-rolled ColorWheel component

Circular hue+saturation picker built from a conic gradient (hue around
the ring) overlaid with a radial white gradient (saturation towards the
centre). Pointer math is extracted as a pure helper so the mapping
(right = hue 0, clockwise; distance/radius clamped to 0-100) can be
tested without a real layout in jsdom. Commit fires on pointerup only,
matching the existing sliders' timing.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: LightControls Bílá/Barva toggle wiring ColorWheel

**Files:**
- Modify: `frontend/src/modules/devices/components/LightControls.tsx`
- Modify: `frontend/src/modules/devices/components/LightControls.test.tsx` (append; existing tests must still pass unchanged)

**Interfaces:**
- Consumes: `Device.supportsColor`, `Device.colorMode`, `Device.hue`, `Device.saturation` (Task 9); `ColorWheel` (Task 10); `sendCommand` with `command: 'setColor'` (Task 9 + Task 7).
- Produces: nothing downstream.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/modules/devices/components/LightControls.test.tsx`:
```tsx
  it('does not render the Bílá/Barva toggle when the device has no color support', () => {
    render(<LightControls device={device({ supportsColor: false })} />)
    expect(screen.queryByRole('tab', { name: 'Barva' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Bílá' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Jas')).toBeInTheDocument()
    expect(screen.getByLabelText('Barva světla')).toBeInTheDocument()
  })

  it('renders the Bílá/Barva toggle when the device supports color', () => {
    render(
      <LightControls
        device={device({ supportsColor: true, colorMode: 'color_temp', hue: 200, saturation: 80 })}
      />,
    )
    expect(screen.getByRole('tab', { name: 'Bílá' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Barva' })).toBeInTheDocument()
    // colorMode !== 'hs' => Bílá is the default tab
    expect(screen.getByLabelText('Barva světla')).toBeInTheDocument()
    expect(screen.queryByRole('slider', { name: /barva/i })).not.toBeInTheDocument()
  })

  it('defaults to the Barva tab when colorMode is "hs"', () => {
    render(
      <LightControls
        device={device({ supportsColor: true, colorMode: 'hs', hue: 200, saturation: 80 })}
      />,
    )
    expect(screen.queryByLabelText('Barva světla')).not.toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /barva/i })).toBeInTheDocument()
  })

  it('does not send any command when the user only switches tabs', () => {
    render(
      <LightControls
        device={device({ supportsColor: true, colorMode: 'color_temp', hue: 200, saturation: 80 })}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Barva' }))
    expect(sendCommand).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('tab', { name: 'Bílá' }))
    expect(sendCommand).not.toHaveBeenCalled()
  })

  it('sends setColor when the color wheel commits', () => {
    render(
      <LightControls
        device={device({ supportsColor: true, colorMode: 'hs', hue: 200, saturation: 80 })}
      />,
    )
    const wheel = screen.getByRole('slider', { name: /barva/i })
    fireEvent.pointerDown(wheel, { clientX: 50, clientY: 50, pointerId: 1 })
    fireEvent.pointerUp(wheel, { clientX: 50, clientY: 50, pointerId: 1 })

    expect(sendCommand).toHaveBeenCalledTimes(1)
    const call = vi.mocked(sendCommand).mock.calls[0]
    expect(call[0]).toBe(1)
    expect(call[1].command).toBe('setColor')
    const payload = call[1].payload as { hue: number; saturation: number }
    expect(typeof payload.hue).toBe('number')
    expect(typeof payload.saturation).toBe('number')
    expect(payload.hue).toBeGreaterThanOrEqual(0)
    expect(payload.hue).toBeLessThanOrEqual(360)
    expect(payload.saturation).toBeGreaterThanOrEqual(0)
    expect(payload.saturation).toBeLessThanOrEqual(100)
  })
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- src/modules/devices/components/LightControls.test.tsx`
Expected: FAIL — no Barva tab, no color wheel.

- [ ] **Step 3: Write minimal implementation**

Replace `frontend/src/modules/devices/components/LightControls.tsx` with:
```tsx
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { sendCommand } from '../api/devices'
import type { Device } from '../types/device'
import { ColorWheel } from './ColorWheel'

const BRIGHTNESS_MIN = 0
const BRIGHTNESS_MAX = 254
const COLOR_TEMP_MIN = 153 // cool white (~6500K)
const COLOR_TEMP_MAX = 500 // warm white (~2000K)

type Tab = 'white' | 'color'

interface LightControlsProps {
  device: Device
  disabled?: boolean
}

export function LightControls({ device, disabled }: LightControlsProps) {
  const [brightness, setBrightness] = useState(device.brightness ?? 180)
  const [colorTemp, setColorTemp] = useState(device.colorTemp ?? 320)
  const [hue, setHue] = useState(device.hue ?? 0)
  const [saturation, setSaturation] = useState(device.saturation ?? 100)
  const [tab, setTab] = useState<Tab>(device.colorMode === 'hs' ? 'color' : 'white')

  const draggingRef = useRef(false)
  const lastSentBrightnessRef = useRef<number | null>(null)
  const lastSentColorTempRef = useRef<number | null>(null)
  const lastSentHueRef = useRef<number | null>(null)
  const lastSentSaturationRef = useRef<number | null>(null)

  useEffect(() => {
    if (draggingRef.current) return
    if (device.brightness === null) return
    if (device.brightness === lastSentBrightnessRef.current) return
    setBrightness(device.brightness)
  }, [device.brightness])

  useEffect(() => {
    if (draggingRef.current) return
    if (device.colorTemp === null) return
    if (device.colorTemp === lastSentColorTempRef.current) return
    setColorTemp(device.colorTemp)
  }, [device.colorTemp])

  useEffect(() => {
    if (draggingRef.current) return
    if (device.hue === null || device.hue === undefined) return
    if (device.hue === lastSentHueRef.current) return
    setHue(device.hue)
  }, [device.hue])

  useEffect(() => {
    if (draggingRef.current) return
    if (device.saturation === null || device.saturation === undefined) return
    if (device.saturation === lastSentSaturationRef.current) return
    setSaturation(device.saturation)
  }, [device.saturation])

  const isOff = device.state !== 'ON'
  const isDisabled = disabled || isOff
  const showToggle = device.supportsColor === true

  const beginGesture = () => {
    draggingRef.current = true
  }

  const commitBrightness = (value: number) => {
    draggingRef.current = false
    lastSentBrightnessRef.current = value
    void sendCommand(device.id, { command: 'setBrightness', payload: { brightness: value } })
  }

  const commitColorTemp = (value: number) => {
    draggingRef.current = false
    lastSentColorTempRef.current = value
    void sendCommand(device.id, { command: 'setColorTemp', payload: { color_temp: value } })
  }

  const commitColor = (h: number, s: number) => {
    draggingRef.current = false
    lastSentHueRef.current = h
    lastSentSaturationRef.current = s
    void sendCommand(device.id, { command: 'setColor', payload: { hue: h, saturation: s } })
  }

  const brightnessPercent = Math.round(
    ((brightness - BRIGHTNESS_MIN) / (BRIGHTNESS_MAX - BRIGHTNESS_MIN)) * 100,
  )
  const brightnessFillStyle = { '--slider-fill': `${brightnessPercent}%` } as CSSProperties
  const colorTempKelvin = Math.round(1_000_000 / colorTemp)

  return (
    <div className="mt-4 space-y-5">
      {showToggle && (
        <div role="tablist" aria-label="Režim světla" className="inline-flex rounded-full border border-line p-1 text-sm">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'white'}
            onClick={() => setTab('white')}
            className={`rounded-full px-4 py-1 ${tab === 'white' ? 'bg-surface-raised text-ink' : 'text-ink-muted'}`}
          >
            Bílá
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'color'}
            onClick={() => setTab('color')}
            className={`rounded-full px-4 py-1 ${tab === 'color' ? 'bg-surface-raised text-ink' : 'text-ink-muted'}`}
          >
            Barva
          </button>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-ink-muted">Jas</span>
          <span className="font-mono tabular-nums text-ink-muted">{brightnessPercent} %</span>
        </div>
        <input
          type="range"
          aria-label="Jas"
          min={BRIGHTNESS_MIN}
          max={BRIGHTNESS_MAX}
          value={brightness}
          disabled={isDisabled}
          onChange={(e) => setBrightness(Number(e.currentTarget.value))}
          onPointerDown={beginGesture}
          onKeyDown={beginGesture}
          onMouseUp={(e) => commitBrightness(Number(e.currentTarget.value))}
          onTouchEnd={(e) => commitBrightness(Number(e.currentTarget.value))}
          onKeyUp={(e) => commitBrightness(Number(e.currentTarget.value))}
          style={brightnessFillStyle}
          className={`light-slider light-slider-brightness w-full ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`}
        />
      </div>

      {(!showToggle || tab === 'white') && (
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-ink-muted">Barva světla</span>
            <span className="font-mono tabular-nums text-ink-muted">{colorTempKelvin} K</span>
          </div>
          <input
            type="range"
            aria-label="Barva světla"
            min={COLOR_TEMP_MIN}
            max={COLOR_TEMP_MAX}
            value={colorTemp}
            disabled={isDisabled}
            onChange={(e) => setColorTemp(Number(e.currentTarget.value))}
            onPointerDown={beginGesture}
            onKeyDown={beginGesture}
            onMouseUp={(e) => commitColorTemp(Number(e.currentTarget.value))}
            onTouchEnd={(e) => commitColorTemp(Number(e.currentTarget.value))}
            onKeyUp={(e) => commitColorTemp(Number(e.currentTarget.value))}
            className={`light-slider light-slider-color-temp w-full ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`}
          />
          <div className="mt-1 flex justify-between text-xs text-ink-faint">
            <span>studená</span>
            <span>teplá</span>
          </div>
        </div>
      )}

      {showToggle && tab === 'color' && (
        <div className="flex justify-center">
          <ColorWheel
            hue={hue}
            saturation={saturation}
            disabled={isDisabled}
            onChange={(h, s) => {
              draggingRef.current = true
              setHue(h)
              setSaturation(s)
            }}
            onCommit={commitColor}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd /Users/jakub/smart-home-core/frontend && npm test -- src/modules/devices/components/LightControls.test.tsx`
Expected: PASS (new tests and all existing LightControls tests unchanged).

- [ ] **Step 5: Commit**
```bash
git add frontend/src/modules/devices/components/LightControls.tsx frontend/src/modules/devices/components/LightControls.test.tsx
git commit -m "$(cat <<'EOF'
feat(devices): add Bílá/Barva toggle wiring the ColorWheel

When device.supportsColor is true, a segmented toggle above the sliders
lets the user pick between the existing color-temp slider and the new
hue/saturation wheel. Default tab follows device.colorMode; switching
tabs sends no command, only interacting with a control does. When
supportsColor is false the layout is byte-identical to what shipped
before.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```
