"""Read-time interpretation of the raw Z2M `exposes` JSON stored on Device."""

from typing import Any


def supports_color(exposes: Any) -> bool:
    """True iff the exposes tree names a `color_hs` feature anywhere.

    Zigbee2MQTT's schema for a color bulb nests hue/saturation inside a
    `color_hs` composite, which itself lives under a `light` expose's
    `features` array. `color_xy` is deliberately excluded — this codebase
    only sends `{"color":{"hue","saturation"}}`.
    """
    if not exposes:
        return False
    return _walk(exposes)


def _walk(node: Any) -> bool:
    if isinstance(node, list):
        return any(_walk(item) for item in node)
    if isinstance(node, dict):
        if node.get("name") == "color_hs":
            return True
        features = node.get("features")
        if features and _walk(features):
            return True
    return False
