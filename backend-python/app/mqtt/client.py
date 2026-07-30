"""Replacement for the SmallRye MQTT connector.

Quarkus opens one connection per channel (five client ids); one connection with
per-filter callbacks is enough here. The client id must differ from the Quarkus
ones so both backends can run against the same broker.
"""

import logging
from collections.abc import Callable

import paho.mqtt.client as mqtt

from app.config import get_settings
from app.mqtt import consumers
from app.mqtt.publisher import mqtt_publisher

log = logging.getLogger(__name__)

RECONNECT_INTERVAL_SECONDS = 5

SUBSCRIPTIONS: list[tuple[str, int, Callable[[str, bytes], None]]] = [
    ("zigbee2mqtt/bridge/devices", 1, consumers.consume_devices),
    ("zigbee2mqtt/bridge/state", 0, consumers.consume_bridge_state),
    ("zigbee2mqtt/bridge/response/device/rename", 1, consumers.consume_rename_response),
    ("zigbee2mqtt/+", 0, consumers.consume_telemetry),
    ("zigbee2mqtt/+/availability", 1, consumers.consume_availability),
]

_client: mqtt.Client | None = None


def _make_callback(handler: Callable[[str, bytes], None]):
    def _on_message(client, userdata, message: mqtt.MQTTMessage) -> None:
        try:
            handler(message.topic, message.payload)
        except Exception:
            log.exception("Unhandled error while processing message on %s", message.topic)

    return _on_message


def _on_connect(client: mqtt.Client, userdata, flags, reason_code, properties=None) -> None:
    if reason_code != 0:
        log.error("MQTT connection failed: %s", reason_code)
        return
    log.info("Connected to MQTT broker")
    for topic, qos, _ in SUBSCRIPTIONS:
        client.subscribe(topic, qos=qos)
        log.info("Subscribed to %s (qos %d)", topic, qos)


def _on_disconnect(client: mqtt.Client, userdata, *args) -> None:
    log.warning("Disconnected from MQTT broker, reconnecting")


def start() -> mqtt.Client | None:
    global _client
    settings = get_settings()
    if not settings.mqtt_enabled:
        log.info("MQTT is disabled, skipping broker connection")
        return None

    client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2,
        client_id=settings.mqtt_client_id,
    )
    client.on_connect = _on_connect
    client.on_disconnect = _on_disconnect
    for topic, _, handler in SUBSCRIPTIONS:
        client.message_callback_add(topic, _make_callback(handler))
    client.reconnect_delay_set(
        min_delay=RECONNECT_INTERVAL_SECONDS, max_delay=RECONNECT_INTERVAL_SECONDS
    )

    client.connect_async(
        settings.mqtt_host, settings.mqtt_port, keepalive=settings.mqtt_keep_alive_seconds
    )
    client.loop_start()

    _client = client
    mqtt_publisher.set_client(client)
    log.info(
        "MQTT client '%s' starting against %s:%d",
        settings.mqtt_client_id,
        settings.mqtt_host,
        settings.mqtt_port,
    )
    return client


def stop() -> None:
    global _client
    if _client is not None:
        _client.loop_stop()
        _client.disconnect()
        _client = None
    mqtt_publisher.set_client(None)
