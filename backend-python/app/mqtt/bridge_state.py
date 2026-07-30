"""Mirror of BridgeStateHolder."""

from datetime import datetime, timezone
from enum import Enum


class BridgeState(str, Enum):
    UNKNOWN = "UNKNOWN"
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"


class BridgeStateHolder:
    def __init__(self) -> None:
        self._state = BridgeState.UNKNOWN
        self._last_change: datetime | None = None

    def set_online(self, online: bool) -> None:
        self._state = BridgeState.ONLINE if online else BridgeState.OFFLINE
        self._last_change = datetime.now(timezone.utc)

    @property
    def state(self) -> BridgeState:
        return self._state

    @property
    def last_change(self) -> datetime | None:
        return self._last_change


bridge_state_holder = BridgeStateHolder()
