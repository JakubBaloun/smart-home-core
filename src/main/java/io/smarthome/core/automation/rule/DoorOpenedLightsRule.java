package io.smarthome.core.automation.rule;

import io.quarkus.logging.Log;
import io.smallrye.mutiny.Uni;
import io.smarthome.core.automation.AutomationRule;
import io.smarthome.core.automation.Rule;
import io.smarthome.core.automation.RuleContext;
import io.smarthome.core.device.service.DeviceCommandService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@ApplicationScoped
@AutomationRule(name = "door-opened-lights", description = "Turn on hallway lights when door opens")
public class DoorOpenedLightsRule implements Rule {

    private static final String CONTACT_FIELD = "contact";
    private static final String TRACKED_DEVICE = "front_door_sensor";
    private static final String HALLWAY_LIGHT = "hallway_light";

    private final Map<String, Object> previousState = new ConcurrentHashMap<>();

    @Inject
    DeviceCommandService commandService;

    @Override
    public boolean appliesTo(String eventType) {
        return "telemetry-received".equals(eventType);
    }

    @Override
    public Uni<Void> evaluate(RuleContext context) {
        if (!TRACKED_DEVICE.equals(context.deviceId())) {
            return Uni.createFrom().voidItem();
        }

        Object raw = context.data().get(CONTACT_FIELD);
        if (!(raw instanceof Boolean contactClosed)) {
            return Uni.createFrom().voidItem();
        }

        Object previousRaw = previousState.put(context.deviceId(), contactClosed);

        if (previousRaw instanceof Boolean previouslyClosed && previouslyClosed && !contactClosed) {
            Log.infof("Door '%s' opened, turning on hallway lights", context.deviceId());
            return commandService.setState(HALLWAY_LIGHT, "ON");
        }
        return Uni.createFrom().voidItem();
    }
}
