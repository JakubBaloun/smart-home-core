"""Mirror of DeviceService, plus the name/identity handling described in
`app/device/identity.py`."""

import json
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.common.events import event_bus
from app.common.exceptions import ResourceNotFoundError
from app.db import read_session, transaction
from app.device import z2m_mapper
from app.device.events import DeviceStateChangedEvent, DevicesSyncedEvent
from app.device.identity import DeviceIdentity
from app.device.models import Device
from app.device.repository import device_repository
from app.device.schemas import UpdateDeviceRequest, Z2MDevicePayload
from app.mqtt.publisher import mqtt_publisher

log = logging.getLogger(__name__)

RENAME_REQUEST_TOPIC = "zigbee2mqtt/bridge/request/device/rename"


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
                    previous_name = existing.friendly_name
                    z2m_mapper.update_entity_from_payload(payload, existing)
                    device_repository.update(existing, session)
                    if previous_name != existing.friendly_name:
                        log.info(
                            "Z2M reports device %s as '%s' (was '%s')",
                            payload.ieee_address,
                            existing.friendly_name,
                            previous_name,
                        )
                        self._remember_name(payload.ieee_address, previous_name, session)
                # Whatever Z2M currently calls the device is a name its telemetry
                # may already be filed under.
                self._remember_name(payload.ieee_address, payload.friendly_name, session)
            device_repository.mark_unavailable_not_in(active_ieee_addresses, session)

        event_bus.publish(
            DevicesSyncedEvent(active_ieee_addresses, len(active_ieee_addresses))
        )
        log.info("Device sync completed.")

    def resolve_identity(self, name_or_address: str) -> DeviceIdentity | None:
        """Resolve an MQTT topic name, an ieee address or a historical name to a
        device. Returns None when nothing in the registry matches."""
        with read_session() as session:
            return self._resolve(name_or_address, session)

    def update_availability(self, friendly_name: str, available: bool) -> None:
        with transaction() as session:
            identity = self._resolve(friendly_name, session)
            if identity is None:
                updated = 0
            else:
                updated = device_repository.update_availability_by_ieee(
                    identity.ieee_address, available, session
                )
        if updated == 0:
            log.debug("Availability update for unknown device '%s' ignored", friendly_name)
        else:
            log.info("Device '%s' is now %s", friendly_name, "online" if available else "offline")

    def update_state(self, ieee_address: str, state: str) -> None:
        with transaction() as session:
            updated = device_repository.update_state_by_ieee(ieee_address, state, session)
        if updated == 0:
            log.debug("State update for unknown device '%s' ignored", ieee_address)
            return
        event_bus.publish(DeviceStateChangedEvent(ieee_address, state))

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
            previous_name = device.friendly_name
            device.friendly_name = request.friendlyName
            if request.type is not None:
                device.type = request.type.value
            device.updated_at = datetime.now(timezone.utc)
            device_repository.update(device, session)

            renamed = previous_name != request.friendlyName
            if renamed:
                # Both names may hold telemetry: the old one from before the
                # rename, the new one if Z2M ever published under it.
                self._remember_name(device.ieee_address, previous_name, session)
                self._remember_name(device.ieee_address, request.friendlyName, session)
            ieee_address = device.ieee_address

        if renamed:
            self._request_z2m_rename(ieee_address, previous_name, request.friendlyName)
        log.info("Device with id %s updated successfully", device_id)

    def delete_device(self, device_id: int) -> None:
        log.info("Deleting device with id %s from the database", device_id)
        with transaction() as session:
            device = device_repository.find_by_id(device_id, session)
            if device is None:
                raise ResourceNotFoundError("Device", device_id)
            device_repository.delete(device, session)
        log.info("Device with id %s deleted successfully", device_id)

    def _resolve(self, value: str, session: Session) -> DeviceIdentity | None:
        if not value:
            return None
        device = (
            device_repository.find_by_ieee_address(value, session)
            or device_repository.find_by_friendly_name(value, session)
            or device_repository.find_by_alias(value, session)
        )
        if device is None:
            return None
        return DeviceIdentity(
            ieee_address=device.ieee_address,
            friendly_name=device.friendly_name,
            aliases=device_repository.list_aliases(device.ieee_address, session),
        )

    def _remember_name(self, ieee_address: str, name: str | None, session: Session) -> None:
        if not name or not ieee_address:
            return
        if device_repository.add_alias(ieee_address, name, session):
            log.info("Recorded telemetry alias '%s' for device %s", name, ieee_address)

    def _request_z2m_rename(self, ieee_address: str, previous_name: str, new_name: str) -> None:
        """Ask Zigbee2MQTT to rename the device so the topic follows the label.

        Best effort and deliberately not part of the request's transaction: the
        label change in Postgres is already valid on its own, and nothing breaks
        if this never lands — the old name stays a resolvable alias, so
        telemetry and availability keep flowing. The outcome is reported
        asynchronously on zigbee2mqtt/bridge/response/device/rename.
        """
        payload = json.dumps(
            {"from": previous_name, "to": new_name, "homeassistant_rename": False},
            separators=(",", ":"),
        ).encode("utf-8")
        try:
            mqtt_publisher.publish(RENAME_REQUEST_TOPIC, payload, qos=1, retain=False)
        except Exception as e:
            log.error(
                "Could not ask Z2M to rename device %s from '%s' to '%s': %s. "
                "The label is saved; Z2M keeps publishing under '%s' until the "
                "rename is retried.",
                ieee_address,
                previous_name,
                new_name,
                e,
                previous_name,
            )
            return
        log.info(
            "Requested Z2M rename of device %s: '%s' -> '%s'",
            ieee_address,
            previous_name,
            new_name,
        )


device_service = DeviceService()
