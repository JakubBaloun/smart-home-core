package io.smarthome.core.device.resource;

import io.smarthome.core.device.Device;
import org.mapstruct.Mapper;

import java.util.List;

@Mapper(componentModel = "jakarta-cdi")
public interface DeviceMapper {

    DeviceResponse toResponse(Device device);

    List<DeviceResponse> toResponseList(List<Device> devices);
}
