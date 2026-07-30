"""Mirror of Z2MStatePayload."""

import json


def is_online(payload: str) -> bool:
    """Z2M 2.x publishes state as JSON ({"state":"online"}), older versions as a
    plain "online"/"offline" string."""
    trimmed = payload.strip()
    if trimmed.startswith("{"):
        try:
            parsed = json.loads(trimmed)
        except ValueError:
            return False
        state = parsed.get("state") if isinstance(parsed, dict) else None
        return _as_text(state).lower() == "online"
    return trimmed.lower() == "online"


def _as_text(value: object) -> str:
    """JsonNode.path(...).asText() — a missing node yields an empty string."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float)):
        return str(value)
    return ""
