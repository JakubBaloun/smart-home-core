"""Read-time interpretation of the raw Z2M `exposes` JSON stored on Device."""

from typing import Any

_COLOR_FEATURE_NAMES = {"color_hs", "color_xy"}


def supports_color(exposes: Any) -> bool:
    """True iff the exposes tree names a `color_hs` or `color_xy` feature anywhere.

    Zigbee2MQTT's schema for a color bulb nests its color feature inside a
    `color_hs` or `color_xy` composite, which itself lives under a `light`
    expose's `features` array. We always send `{"color":{"hue","saturation"}}`
    regardless of which composite a device exposes — Z2M's generic color
    converter accepts hue/saturation and converts to xy internally for
    xy-only devices (e.g. Tuya TS0505B) — so both composite types count as
    color support here.
    """
    if not exposes:
        return False
    return _walk(exposes)


def _walk(node: Any) -> bool:
    if isinstance(node, list):
        return any(_walk(item) for item in node)
    if isinstance(node, dict):
        if node.get("name") in _COLOR_FEATURE_NAMES:
            return True
        features = node.get("features")
        if features and _walk(features):
            return True
    return False
