"""CIE 1931 xy chromaticity -> hue/saturation conversion.

Xy-only bulbs (e.g. Tuya TS0505B, see app.device.capabilities) report their
current color as `{"x": ..., "y": ...}` in Z2M state payloads, never as
hue/saturation — but our schema and UI (ColorWheel) only track hue/
saturation. This mirrors the standard sRGB D65 xy->RGB matrix used by
Philips Hue's published color conversion and by Z2M's own color library.
"""

import colorsys


def xy_to_hue_saturation(x: float, y: float) -> tuple[int, int]:
    """Convert xy chromaticity to (hue 0-360, saturation 0-100).

    Assumes full brightness (Y=1) — brightness is tracked separately via
    the device's own `brightness` field, so only hue/saturation are derived
    here.
    """
    if y <= 0:
        return 0, 0

    z = 1.0 - x - y
    big_y = 1.0
    big_x = (big_y / y) * x
    big_z = (big_y / y) * z

    r = big_x * 1.656492 - big_y * 0.354851 - big_z * 0.255038
    g = -big_x * 0.707196 + big_y * 1.655397 + big_z * 0.036152
    b = big_x * 0.051713 - big_y * 0.121364 + big_z * 1.011530

    r, g, b = (_gamma_correct(c) for c in (r, g, b))
    hue, saturation, _value = colorsys.rgb_to_hsv(r, g, b)
    return round(hue * 360) % 360, round(saturation * 100)


def _gamma_correct(c: float) -> float:
    c = max(0.0, c)
    c = 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055
    return min(1.0, max(0.0, c))
