-- Every MQTT/telemetry name a device has ever been known by.
--
-- Telemetry in InfluxDB is tagged with the immutable ieee_address from this
-- release onwards, but all history written before it is tagged with the
-- friendly name that was current at the time. This table records those names so
-- that a device's chart can union its ieee_address with its historical names,
-- and so that an inbound zigbee2mqtt/<name> topic still resolves to a device
-- after a rename that Zigbee2MQTT has not (yet) applied.
--
-- alias is globally unique: a name identifies at most one device, so two
-- devices that have held the same name at different times cannot inherit each
-- other's history. First claimant wins.
CREATE TABLE device_alias (
    id BIGSERIAL PRIMARY KEY,
    ieee_address VARCHAR(24) NOT NULL REFERENCES device(ieee_address) ON DELETE CASCADE,
    alias VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_device_alias_ieee_address ON device_alias(ieee_address);

-- Seed: the name each device currently has is the name its existing telemetry
-- is tagged with. Purely additive; no telemetry is touched.
INSERT INTO device_alias (ieee_address, alias)
SELECT ieee_address, friendly_name FROM device
ON CONFLICT DO NOTHING;
