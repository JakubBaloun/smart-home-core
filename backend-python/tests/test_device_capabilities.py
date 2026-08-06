"""Guards derivation of supportsColor from the raw Z2M exposes JSON."""

from app.device.capabilities import supports_color

RGB_BULB_EXPOSES = [
    {
        "type": "light",
        "features": [
            {"name": "state", "type": "binary"},
            {"name": "brightness", "type": "numeric", "value_min": 0, "value_max": 254},
            {"name": "color_temp", "type": "numeric", "value_min": 153, "value_max": 500},
            {
                "type": "composite",
                "name": "color_hs",
                "features": [
                    {"name": "hue", "type": "numeric", "value_min": 0, "value_max": 360},
                    {"name": "saturation", "type": "numeric", "value_min": 0, "value_max": 100},
                ],
            },
        ],
    }
]

RGB_LED_STRIP_EXPOSES = [
    {
        "type": "light",
        "features": [
            {"name": "state", "type": "binary"},
            {"name": "brightness", "type": "numeric", "value_min": 0, "value_max": 254},
            {
                "type": "composite",
                "name": "color_hs",
                "features": [
                    {"name": "hue", "type": "numeric", "value_min": 0, "value_max": 360},
                    {"name": "saturation", "type": "numeric", "value_min": 0, "value_max": 100},
                ],
            },
        ],
    },
    {"name": "linkquality", "type": "numeric"},
]

COLOR_TEMP_ONLY_EXPOSES = [
    {
        "type": "light",
        "features": [
            {"name": "state", "type": "binary"},
            {"name": "brightness", "type": "numeric", "value_min": 0, "value_max": 254},
            {"name": "color_temp", "type": "numeric", "value_min": 153, "value_max": 500},
        ],
    }
]


def test_supports_color_true_for_rgb_bulb():
    assert supports_color(RGB_BULB_EXPOSES) is True


def test_supports_color_true_for_rgb_led_strip():
    assert supports_color(RGB_LED_STRIP_EXPOSES) is True


def test_supports_color_false_for_color_temp_only_bulb():
    assert supports_color(COLOR_TEMP_ONLY_EXPOSES) is False


def test_supports_color_false_for_none():
    assert supports_color(None) is False


def test_supports_color_false_for_empty_list():
    assert supports_color([]) is False


def test_supports_color_false_for_sensor_without_light_expose():
    exposes = [
        {"name": "temperature", "type": "numeric"},
        {"name": "humidity", "type": "numeric"},
    ]
    assert supports_color(exposes) is False


def test_supports_color_ignores_color_xy_only():
    exposes = [
        {
            "type": "light",
            "features": [
                {
                    "type": "composite",
                    "name": "color_xy",
                    "features": [
                        {"name": "x", "type": "numeric"},
                        {"name": "y", "type": "numeric"},
                    ],
                }
            ],
        }
    ]
    assert supports_color(exposes) is False
