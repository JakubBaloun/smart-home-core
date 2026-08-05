"""Mirror of DeviceResource / CommandResource."""

import logging
import asyncio
import json
from queue import Empty, Queue
from typing import Any

from fastapi import APIRouter, Response
from fastapi.responses import StreamingResponse

from app.common.events import event_bus
from app.common.exceptions import BadRequestError, DeviceUnavailableError
from app.device import mappers
from app.device.command_service import device_command_service
from app.device.events import DeviceStateChangedEvent
from app.device.schemas import DeviceCommandRequest, DeviceResponse, UpdateDeviceRequest
from app.device.service import device_service

log = logging.getLogger(__name__)

device_router = APIRouter(prefix="/api/devices", tags=["devices"])


@device_router.get("/events")
async def stream_device_events() -> StreamingResponse:
    """Streams device reports to connected dashboards without waiting for polling."""
    events: Queue[DeviceStateChangedEvent] = Queue()

    def on_state_changed(event: DeviceStateChangedEvent) -> None:
        events.put(event)

    event_bus.subscribe(DeviceStateChangedEvent, on_state_changed)

    async def stream():
        try:
            while True:
                try:
                    event = await asyncio.to_thread(events.get, True, 15)
                    payload = json.dumps({"ieeeAddress": event.ieee_address, "state": event.state})
                    yield f"event: state\ndata: {payload}\n\n"
                except Empty:
                    yield ": keepalive\n\n"
        finally:
            event_bus.unsubscribe(DeviceStateChangedEvent, on_state_changed)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@device_router.get("", response_model=list[DeviceResponse])
def get_all_devices() -> list[DeviceResponse]:
    log.info("Request received to get all devices")
    return mappers.to_response_list(device_service.get_all_devices())


@device_router.get("/{device_id}", response_model=DeviceResponse)
def get_device_by_id(device_id: int) -> DeviceResponse:
    log.info("Request received to get device with id: %s", device_id)
    return mappers.to_response(device_service.get_device_by_id(device_id))


@device_router.put("/{device_id}", status_code=204, response_class=Response)
def update_device(device_id: int, request: UpdateDeviceRequest) -> Response:
    log.info("Request received to update device with id: %s", device_id)
    device_service.update_device(device_id, request)
    return Response(status_code=204)


@device_router.delete("/{device_id}", status_code=204, response_class=Response)
def delete_device(device_id: int) -> Response:
    log.info("Request received to delete device with id: %s", device_id)
    device_service.delete_device(device_id)
    return Response(status_code=204)


@device_router.post("/{device_id}/command", status_code=202, response_class=Response)
def send_command(device_id: int, request: DeviceCommandRequest) -> Response:
    log.info("Command request received for device %s: %s", device_id, request.command)

    device = device_service.get_device_by_id(device_id)
    if not device.available:
        raise DeviceUnavailableError(device.friendly_name)

    _route_command(device.friendly_name, request)
    return Response(status_code=202)


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
    elif request.command == "raw":
        if payload is None:
            raise BadRequestError("payload is required for 'raw' command")
        device_command_service.send_raw_command(friendly_name, payload)
    else:
        raise BadRequestError(f"Unknown command: '{request.command}'")


def _require_field(payload: dict[str, Any] | None, field: str) -> None:
    if payload is None or field not in payload:
        raise BadRequestError(f"payload must contain '{field}'")


def _as_text(value: Any) -> str:
    """Jackson JsonNode.asText() semantics."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float)):
        return str(value)
    return ""


def _as_int(value: Any) -> int:
    """Jackson JsonNode.asInt() semantics — non-numeric nodes yield 0."""
    if isinstance(value, bool):
        return 1 if value else 0
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            try:
                return int(float(value))
            except ValueError:
                return 0
    return 0
