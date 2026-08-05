"""Mirror of DeviceMapper (MapStruct)."""

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
    )


def to_response_list(devices: list[Device]) -> list[DeviceResponse]:
    return [to_response(d) for d in devices]
