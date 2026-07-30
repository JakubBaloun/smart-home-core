"""Mirror of DeviceCommandService — publishes to zigbee2mqtt/<name>/set."""

import json
import logging
from typing import Any

from app.mqtt.publisher import mqtt_publisher

log = logging.getLogger(__name__)


class DeviceCommandService:
    def set_state(self, friendly_name: str, state: str) -> None:
        self._send(friendly_name, {"state": state.upper()})

    def set_brightness(self, friendly_name: str, brightness: int) -> None:
        self._send(friendly_name, {"brightness": brightness})

    def set_color_temp(self, friendly_name: str, color_temp: int) -> None:
        self._send(friendly_name, {"color_temp": color_temp})

    def send_raw_command(self, friendly_name: str, payload: dict[str, Any]) -> None:
        self._send(friendly_name, payload)

    def _send(self, friendly_name: str, payload: dict[str, Any]) -> None:
        topic = f"zigbee2mqtt/{friendly_name}/set"
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        try:
            mqtt_publisher.publish(topic, body, qos=1, retain=False)
        except Exception as e:
            log.error("Failed to send command to %s: %s", topic, e)
            raise
        log.info("Command sent to %s: %s", topic, body.decode("utf-8"))


device_command_service = DeviceCommandService()
