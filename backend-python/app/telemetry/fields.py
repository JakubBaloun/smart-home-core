"""KNOWN_FIELDS lives on TelemetryConsumer in Quarkus; it is kept in the telemetry
package here so the REST layer does not have to import the MQTT layer."""

KNOWN_FIELDS: frozenset[str] = frozenset(
    {"temperature", "humidity", "battery", "power", "voltage", "energy", "linkquality", "contact", "state"}
)

# Java's Set.of has an unspecified (per-JVM randomized) iteration order, so the
# order inside the 400 message is not stable there either. Fixed here.
KNOWN_FIELDS_ORDERED: tuple[str, ...] = (
    "temperature",
    "humidity",
    "battery",
    "power",
    "voltage",
    "energy",
    "linkquality",
    "contact",
    "state",
)
