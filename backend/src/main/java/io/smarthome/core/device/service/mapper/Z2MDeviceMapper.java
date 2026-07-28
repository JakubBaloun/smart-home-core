package io.smarthome.core.device.service.mapper;

import io.smarthome.core.device.Device;
import io.smarthome.core.device.DeviceType;
import io.smarthome.core.device.Z2MDevicePayload;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.Named;

@Mapper(componentModel = "jakarta-cdi")
public interface Z2MDeviceMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "lastSeen", expression = "java(java.time.OffsetDateTime.now())")
    @Mapping(target = "available", constant = "true")
    @Mapping(target = "type", source = ".", qualifiedByName = "determineType")
    @Mapping(target = "vendor", source = ".", qualifiedByName = "resolveVendor")
    @Mapping(target = "model", source = ".", qualifiedByName = "resolveModel")
    Device toEntity(Z2MDevicePayload payload);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "ieeeAddress", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", expression = "java(java.time.OffsetDateTime.now())")
    @Mapping(target = "lastSeen", ignore = true)
    // availability is owned by the zigbee2mqtt/+/availability topic, not by device sync
    @Mapping(target = "available", ignore = true)
    @Mapping(target = "type", source = ".", qualifiedByName = "determineType")
    @Mapping(target = "vendor", source = ".", qualifiedByName = "resolveVendor")
    @Mapping(target = "model", source = ".", qualifiedByName = "resolveModel")
    void updateEntityFromPayload(Z2MDevicePayload payload, @MappingTarget Device device);

    // Z2M nests vendor/model under 'definition'; top-level fields are a legacy fallback
    @Named("resolveVendor")
    default String resolveVendor(Z2MDevicePayload payload) {
        if (payload.definition() != null && payload.definition().vendor() != null) {
            return payload.definition().vendor();
        }
        return payload.vendor();
    }

    @Named("resolveModel")
    default String resolveModel(Z2MDevicePayload payload) {
        if (payload.definition() != null && payload.definition().model() != null) {
            return payload.definition().model();
        }
        return payload.model();
    }

    @Named("determineType")
    default DeviceType determineType(Z2MDevicePayload payload) {
        if (payload.definition() == null || payload.definition().description() == null) {
            return DeviceType.OTHER;
        }

        String desc = payload.definition().description().toLowerCase();

        if (desc.contains("light") || desc.contains("bulb") || desc.contains("led")) {
            return DeviceType.LIGHT;
        }
        if (desc.contains("sensor") || desc.contains("motion") || desc.contains("occupancy") || desc.contains("temperature")) {
            return DeviceType.SENSOR;
        }
        if (desc.contains("switch") || desc.contains("button")) {
            return DeviceType.SWITCH;
        }
        return DeviceType.OTHER;
    }
}
