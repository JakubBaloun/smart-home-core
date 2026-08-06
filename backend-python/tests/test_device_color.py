"""Guards the CIE xy -> hue/saturation conversion for xy-only bulbs (e.g. Tuya TS0505B)."""

from app.device.color import xy_to_hue_saturation


def test_xy_to_hue_saturation_red_primary():
    assert xy_to_hue_saturation(0.7006, 0.2993) == (0, 100)


def test_xy_to_hue_saturation_green_primary():
    assert xy_to_hue_saturation(0.1724, 0.7468) == (120, 100)


def test_xy_to_hue_saturation_blue_primary():
    hue, saturation = xy_to_hue_saturation(0.1355, 0.0399)
    assert 235 <= hue <= 245
    assert saturation == 100


def test_xy_to_hue_saturation_neutral_white_has_low_saturation():
    _hue, saturation = xy_to_hue_saturation(0.3127, 0.3290)
    assert saturation <= 10


def test_xy_to_hue_saturation_zero_y_returns_zero():
    assert xy_to_hue_saturation(0.5, 0.0) == (0, 0)
