from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass(frozen=True)
class TelemetryReceivedEvent:
    device_name: str
    fields: dict[str, Any]
    timestamp: datetime
