package io.smarthome.core.automation;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;

import java.util.List;
import java.util.Optional;

@ConfigMapping(prefix = "automation")
public interface AutomationConfig {

    NightMode nightMode();

    DoorOpenedLights doorOpenedLights();

    TemperatureAlert temperatureAlert();

    interface NightMode {
        @WithDefault("true")
        boolean enabled();

        /** Friendly names of lights to turn off at midnight. */
        Optional<List<String>> lights();
    }

    interface DoorOpenedLights {
        @WithDefault("true")
        boolean enabled();

        @WithDefault("front_door_sensor")
        String doorSensor();

        @WithDefault("hallway_light")
        List<String> lights();
    }

    interface TemperatureAlert {
        @WithDefault("true")
        boolean enabled();

        /** Friendly name of the device to watch; empty means every device reporting temperature. */
        Optional<String> device();

        @WithDefault("30.0")
        double threshold();
    }
}
