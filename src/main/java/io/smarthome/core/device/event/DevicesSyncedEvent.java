package io.smarthome.core.device.event;

import java.util.List;

public record DevicesSyncedEvent(
        List<String> syncedIeeeAddresses,
        int count
) {}