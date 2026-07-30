"""Mirror of DeviceService."""

import logging
from datetime import datetime, timezone

from app.common.events import event_bus
from app.common.exceptions import ResourceNotFoundError
from app.db import read_session, transaction
from app.device import z2m_mapper
from app.device.events import DevicesSyncedEvent
from app.device.models import Device
from app.device.repository import device_repository
from app.device.schemas import UpdateDeviceRequest, Z2MDevicePayload

log = logging.getLogger(__name__)


class DeviceService:
    def sync_devices(self, payloads: list[Z2MDevicePayload]) -> None:
        active_ieee_addresses = [p.ieee_address for p in payloads]
        log.info("Syncing %d devices from Z2M.", len(active_ieee_addresses))

        with transaction() as session:
            for payload in payloads:
                existing = device_repository.find_by_ieee_address(payload.ieee_address, session)
                if existing is None:
                    device_repository.save(z2m_mapper.to_entity(payload), session)
                else:
                    z2m_mapper.update_entity_from_payload(payload, existing)
                    device_repository.update(existing, session)
            device_repository.mark_unavailable_not_in(active_ieee_addresses, session)

        event_bus.publish(
            DevicesSyncedEvent(active_ieee_addresses, len(active_ieee_addresses))
        )
        log.info("Device sync completed.")

    def update_availability(self, friendly_name: str, available: bool) -> None:
        with transaction() as session:
            updated = device_repository.update_availability(friendly_name, available, session)
        if updated == 0:
            log.debug("Availability update for unknown device '%s' ignored", friendly_name)
        else:
            log.info("Device '%s' is now %s", friendly_name, "online" if available else "offline")

    def get_all_devices(self) -> list[Device]:
        with read_session() as session:
            devices = device_repository.list_all(session)
            log.debug("Retrieved %d devices from the database", len(devices))
            return devices

    def get_device_by_id(self, device_id: int) -> Device:
        with read_session() as session:
            device = device_repository.find_by_id(device_id, session)
            if device is None:
                raise ResourceNotFoundError("Device", device_id)
            log.debug("Device with id %s retrieved successfully", device_id)
            return device

    def update_device(self, device_id: int, request: UpdateDeviceRequest) -> None:
        log.info("Updating device with id %s in the database", device_id)
        with transaction() as session:
            device = device_repository.find_by_id(device_id, session)
            if device is None:
                raise ResourceNotFoundError("Device", device_id)
            device.friendly_name = request.friendlyName
            if request.type is not None:
                device.type = request.type.value
            device.updated_at = datetime.now(timezone.utc)
            device_repository.update(device, session)
        log.info("Device with id %s updated successfully", device_id)

    def delete_device(self, device_id: int) -> None:
        log.info("Deleting device with id %s from the database", device_id)
        with transaction() as session:
            device = device_repository.find_by_id(device_id, session)
            if device is None:
                raise ResourceNotFoundError("Device", device_id)
            device_repository.delete(device, session)
        log.info("Device with id %s deleted successfully", device_id)


device_service = DeviceService()
