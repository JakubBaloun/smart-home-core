"""Outgoing MQTT side of the z2m-command channel.

The paho client is injected at startup; until then publishing raises, which
mirrors an unconnected SmallRye emitter failing its Uni.
"""

import logging

log = logging.getLogger(__name__)


class MqttPublisher:
    def __init__(self) -> None:
        self._client = None

    def set_client(self, client) -> None:
        self._client = client

    def publish(self, topic: str, payload: bytes, qos: int = 1, retain: bool = False) -> None:
        if self._client is None:
            raise RuntimeError("MQTT client is not connected")
        info = self._client.publish(topic, payload, qos=qos, retain=retain)
        if info.rc != 0:
            raise RuntimeError(f"MQTT publish to {topic} failed with rc={info.rc}")


mqtt_publisher = MqttPublisher()
