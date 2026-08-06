"""Guards the V1.9.0 schema addition: exposes/hue/saturation columns on `device`."""

from sqlalchemy import text

from app.db import read_session


def test_device_table_has_exposes_hue_saturation_columns():
    with read_session() as session:
        rows = session.execute(
            text(
                "SELECT column_name, data_type FROM information_schema.columns "
                "WHERE table_name = 'device' "
                "AND column_name IN ('exposes', 'hue', 'saturation') "
                "ORDER BY column_name"
            )
        ).all()

    assert [(r[0], r[1]) for r in rows] == [
        ("exposes", "jsonb"),
        ("hue", "smallint"),
        ("saturation", "smallint"),
    ]
