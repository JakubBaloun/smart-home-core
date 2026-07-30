from dataclasses import dataclass


@dataclass(frozen=True)
class DevicesSyncedEvent:
    synced_ieee_addresses: list[str]
    count: int
