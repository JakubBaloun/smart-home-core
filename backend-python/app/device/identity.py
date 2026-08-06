"""Device identity — the split between "who a device is" and "what it is called".

`ieee_address` is the device's immutable hardware identity and is the InfluxDB
`device_id` tag. `friendly_name` is a cosmetic label that the user (or
Zigbee2MQTT) may change at any time; every name a device has ever carried is
kept as an alias so that:

  * an inbound `zigbee2mqtt/<name>` topic still resolves after a rename, even
    if the rename never reached Zigbee2MQTT, and
  * telemetry written before the tag switch (which is tagged with the friendly
    name of the day) stays readable alongside the new ieee-tagged points.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class DeviceIdentity:
    ieee_address: str
    friendly_name: str
    aliases: list[str] = field(default_factory=list)
    type: str = ""

    @property
    def telemetry_keys(self) -> list[str]:
        """Every InfluxDB `device_id` tag value this device's data may sit under.

        The ieee address comes first: it is where all new points are written.
        The rest are historical names, kept so charts do not go blank at the
        cutover or after a rename.
        """
        keys = [self.ieee_address]
        for name in [self.friendly_name, *self.aliases]:
            if name and name not in keys:
                keys.append(name)
        return keys
