# MQTT Patterns

> How `backend-python/app/mqtt/` actually integrates with Eclipse Mosquitto and Zigbee2MQTT.
> SmallRye Reactive Messaging is gone; this is plain paho-mqtt.

## Topology

```
Zigbee devices ──Zigbee──▶ Zigbee2MQTT ──MQTT──▶ Mosquitto ──MQTT──▶ backend-python
                                                     ▲                    │
                                                     └────── commands ────┘
```

Quarkus opened **five** SmallRye channels and therefore five broker connections. The port uses
**one** paho connection with `message_callback_add` per topic filter. The client id is
`smart-home-py` (`MQTT_CLIENT_ID`), deliberately different from the Quarkus `smart-home-core-*`
ids so both backends could subscribe during parity checks.

## Subscriptions

Declared once in `mqtt/client.py` and nowhere else:

```python
SUBSCRIPTIONS: list[tuple[str, int, Callable[[str, bytes], None]]] = [
    ("zigbee2mqtt/bridge/devices", 1, consumers.consume_devices),
    ("zigbee2mqtt/bridge/state",   0, consumers.consume_bridge_state),
    ("zigbee2mqtt/+",              0, consumers.consume_telemetry),
    ("zigbee2mqtt/+/availability", 1, consumers.consume_availability),
]
```

- The QoS per topic is inherited from the corresponding Quarkus channel — keep it
- Subscriptions are re-established in `_on_connect`, **not** once at startup. A broker restart
  would otherwise leave the client connected but silently un-subscribed.
- `connect_async` + `loop_start()`, with `reconnect_delay_set(min=5, max=5)`. There is no
  hand-rolled reconnect loop; paho owns it.
- `MQTT_ENABLED=false` skips the connection entirely (used by the test suite)

Adding a topic means adding a tuple to `SUBSCRIPTIONS` and a consumer function. There is no
annotation-based registration to forget.

## Topic contract (Zigbee2MQTT)

| Topic                                  | Direction | Purpose                                          |
| -------------------------------------- | --------- | ------------------------------------------------ |
| `zigbee2mqtt/bridge/devices` (retained) | in        | Full device list → sync into PostgreSQL          |
| `zigbee2mqtt/bridge/state`              | in        | Bridge online/offline → `BridgeStateHolder`, `/q/health` |
| `zigbee2mqtt/<friendly_name>`           | in        | Telemetry → InfluxDB                             |
| `zigbee2mqtt/<friendly_name>/availability` | in     | Device availability (needs the Z2M availability feature) |
| `zigbee2mqtt/<friendly_name>/set`       | out       | Commands                                         |

`zigbee2mqtt/+` also matches `zigbee2mqtt/bridge/...`-adjacent traffic, so `consume_telemetry`
explicitly skips topics containing `/bridge/`.

## Consumer pattern

Every consumer has the same signature and the same failure posture:

```python
def consume_x(topic: str, payload: bytes) -> None:
    try:
        ...
    except Exception as e:
        log.error("Failed to ...: %s", e)
```

- Signature is always `(topic: str, payload: bytes) -> None` — decode explicitly with
  `payload.decode("utf-8")`
- **Consumers swallow their own exceptions.** This matches `failure-strategy: ignore` on every
  Quarkus incoming channel: a failing message is dropped and the subscription survives. Never
  let an exception escape into the paho network thread.
- `_make_callback` in `client.py` is a second safety net that logs anything that still escapes
- Consumers hold no state. Persistent state lives in `bridge_state_holder` or the database.
- Consumers call **services**, never repositories

### Telemetry filtering

`consume_telemetry` is the one with real logic, and the order matters:

1. Skip `/bridge/` topics
2. Derive the device name by stripping the `zigbee2mqtt/` prefix
3. Parse JSON; a parse failure is a `warning`, not an error, and returns
4. Reject non-object payloads
5. Keep only keys in `KNOWN_FIELDS`; if nothing remains, return without writing
6. Write to InfluxDB, then publish `TelemetryReceivedEvent` — **only after a successful write**,
   so automation never reacts to data that was not stored

`KNOWN_FIELDS` lives in `telemetry/fields.py`, not in the MQTT layer. In Quarkus the constant sat
on `TelemetryConsumer` and `TelemetryResource` imported it; mirroring that literally would make
the REST layer depend on the MQTT layer.

### Availability ownership

`consume_availability` is the **only** writer of `device.available` / `device.last_seen`.
`z2m_mapper.update_entity_from_payload` must never touch those two columns — device sync
overwriting them would flap availability on every discovery message. This is a standing
invariant, verified in both backends.

Payload shape is handled by `mqtt/state_payload.is_online`, which accepts both Z2M 2.x JSON
(`{"state":"online"}`) and the older bare `online`/`offline` string.

## Publishing

`mqtt/publisher.py` holds a single `MqttPublisher` whose paho client is injected by
`client.start()`. Until then `publish()` raises, mirroring an unconnected SmallRye emitter.

Application code does not use it directly — it goes through `device/command_service.py`:

```python
device_command_service.set_state(friendly_name, "ON")
device_command_service.set_brightness(friendly_name, 200)
device_command_service.set_color_temp(friendly_name, 370)
device_command_service.send_raw_command(friendly_name, payload)
```

- Topic is always `zigbee2mqtt/<friendly_name>/set`, QoS 1, `retain=False`
- Payload is `json.dumps(payload, separators=(",", ":"))` — **compact separators are required**.
  The verified wire format is exactly `{"state":"ON"}`, `{"brightness":200}`,
  `{"color_temp":370}`, with no spaces.
- `set_state` upper-cases the state
- A publish failure is logged **and re-raised** (unlike consumers, which swallow)

Command dispatch from REST lives in `device/router.py::_route_command`: `setState`,
`setBrightness`, `setColorTemp`, `raw`; anything else raises `BadRequestError`
(`Unknown command: '<x>'`). A missing payload key raises
`BadRequestError("payload must contain '<field>'")`. The device must be `available` or the
router raises `DeviceUnavailableError` → 409.

## Bridge state and health

`BridgeStateHolder` tracks `UNKNOWN` / `ONLINE` / `OFFLINE` plus the last change timestamp.
`/q/health` reproduces the SmallRye envelope and the `zigbee2mqtt-bridge` check byte-for-byte:

```json
{"status": "UP", "checks": [{"name": "zigbee2mqtt-bridge", "status": "UP",
 "data": {"state": "online", "lastChange": "..."}}]}
```

- `UNKNOWN` stays **UP** so a quiet bridge does not block readiness at startup; only `OFFLINE`
  is DOWN, and DOWN returns 503
- The framework-supplied Quarkus checks (messaging liveness/readiness/startup, datasource) are
  deliberately not reproduced — they describe Quarkus internals. The frontend does not consume
  `/q/health`, so this has no parity impact.

## Testing MQTT

- `MQTT_ENABLED=false` in `tests/conftest.py` — the suite never opens a broker connection
- Consumers are tested by calling them directly with a topic and encoded payload:
  `consumers.consume_devices("zigbee2mqtt/bridge/devices", json.dumps(payload).encode())`
- The database is real; only the outbound edges are faked
- Outgoing commands are captured by patching the publisher:

```python
monkeypatch.setattr(
    "app.mqtt.publisher.mqtt_publisher.publish",
    lambda topic, payload, qos=1, retain=False: sent.append((topic, payload)),
)
```

- InfluxDB is kept out with `monkeypatch.setattr(telemetry_service, "write_telemetry", ...)`
- There is no Mosquitto testcontainer and no test of paho itself

## Local debugging

```bash
docker exec mqtt-broker-dev mosquitto_sub -v -t 'zigbee2mqtt/#'
docker exec mqtt-broker-dev mosquitto_pub -t zigbee2mqtt/temp -m '{"temperature":25.5}'
```

**Never run two backends against the same broker** for longer than a parity check. They
subscribe to the same topics, so telemetry lands in InfluxDB twice and automation rules fire
twice, publishing duplicate commands to real devices.
