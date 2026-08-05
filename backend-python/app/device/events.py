from dataclasses import dataclass


@dataclass(frozen=True)
class DevicesSyncedEvent:
    synced_ieee_addresses: list[str]
    count: int


@dataclass(frozen=True)
class DeviceStateChangedEvent:
    """A state reported by Zigbee2MQTT after the physical device applied it."""

    ieee_address: str
    state: str
