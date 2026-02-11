package io.smarthome.core.mqtt;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.logging.Log;
import io.smallrye.mutiny.Uni;
import io.smarthome.core.device.Z2MDevicePayload;
import io.smarthome.core.device.service.DeviceService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.reactive.messaging.Incoming;


import java.util.List;

@ApplicationScoped
public class DeviceDiscoveryConsumer {

    @Inject
    ObjectMapper objectMapper;

    @Inject
    DeviceService deviceService;

    @Incoming("z2m-devices")
    public Uni<Void> consume(String payload) {
        return Uni.createFrom().item(payload)
                .invoke(() -> Log.infof("Received Z2M device discovery payload, beginning sync process"))
                .map(str -> {
                    try {
                        return objectMapper.readValue(str, new TypeReference<List<Z2MDevicePayload>>() {});
                    } catch (JsonProcessingException e) {
                        throw new RuntimeException("Failed to parse Z2M payload", e);
                    }
                })
                .chain(dtos -> deviceService.syncDevices(dtos))
                .replaceWithVoid();
    }
}
