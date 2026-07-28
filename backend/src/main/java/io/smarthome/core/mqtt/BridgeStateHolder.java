package io.smarthome.core.mqtt;

import jakarta.enterprise.context.ApplicationScoped;

import java.time.Instant;
import java.util.Optional;

@ApplicationScoped
public class BridgeStateHolder {

    public enum State { UNKNOWN, ONLINE, OFFLINE }

    private volatile State state = State.UNKNOWN;
    private volatile Instant lastChange;

    public void setOnline(boolean online) {
        this.state = online ? State.ONLINE : State.OFFLINE;
        this.lastChange = Instant.now();
    }

    public State getState() {
        return state;
    }

    public Optional<Instant> getLastChange() {
        return Optional.ofNullable(lastChange);
    }
}
