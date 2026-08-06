"""Mirror of DeviceRepository."""

from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.device.models import Device, DeviceAlias, DeviceType


class DeviceRepository:
    def list_all(self, session: Session) -> list[Device]:
        return list(session.scalars(select(Device)))

    def find_by_id(self, device_id: int, session: Session) -> Device | None:
        return session.get(Device, device_id)

    def find_by_type(self, device_type: DeviceType, session: Session) -> list[Device]:
        return list(session.scalars(select(Device).where(Device.type == device_type.value)))

    def find_by_ieee_address(self, ieee_address: str, session: Session) -> Device | None:
        return session.scalars(
            select(Device).where(Device.ieee_address == ieee_address)
        ).one_or_none()

    def find_by_friendly_name(self, friendly_name: str, session: Session) -> Device | None:
        """friendly_name is not unique in the schema; the lowest id wins."""
        return session.scalars(
            select(Device).where(Device.friendly_name == friendly_name).order_by(Device.id).limit(1)
        ).first()

    def find_by_alias(self, alias: str, session: Session) -> Device | None:
        return session.scalars(
            select(Device)
            .join(DeviceAlias, DeviceAlias.ieee_address == Device.ieee_address)
            .where(DeviceAlias.alias == alias)
        ).first()

    def list_aliases(self, ieee_address: str, session: Session) -> list[str]:
        return list(
            session.scalars(
                select(DeviceAlias.alias)
                .where(DeviceAlias.ieee_address == ieee_address)
                .order_by(DeviceAlias.id)
            )
        )

    def add_alias(self, ieee_address: str, alias: str, session: Session) -> bool:
        """No-op when the name is already claimed — by this device or another one.

        Returns True when a row was actually inserted.
        """
        if not alias or not alias.strip():
            return False
        # RETURNING rather than rowcount: an ORM insert through psycopg reports
        # rowcount -1, which would read as "inserted" for every skipped row.
        inserted = session.execute(
            pg_insert(DeviceAlias)
            .values(ieee_address=ieee_address, alias=alias)
            .on_conflict_do_nothing()
            .returning(DeviceAlias.id)
        ).first()
        return inserted is not None

    def save(self, device: Device, session: Session) -> None:
        session.add(device)
        session.flush()

    def delete(self, device: Device, session: Session) -> None:
        session.delete(device)
        session.flush()

    def update(self, device: Device, session: Session) -> None:
        session.add(device)
        session.flush()

    def update_availability(self, friendly_name: str, available: bool, session: Session) -> int:
        result = session.execute(
            update(Device)
            .where(Device.friendly_name == friendly_name)
            .values(**self._availability_values(available))
        )
        return result.rowcount

    def update_availability_by_ieee(
        self, ieee_address: str, available: bool, session: Session
    ) -> int:
        result = session.execute(
            update(Device)
            .where(Device.ieee_address == ieee_address)
            .values(**self._availability_values(available))
        )
        return result.rowcount

    def update_state_by_ieee(self, ieee_address: str, state: str, session: Session) -> int:
        result = session.execute(
            update(Device)
            .where(Device.ieee_address == ieee_address)
            .values(state=state, updated_at=datetime.now(timezone.utc))
        )
        return result.rowcount

    def update_light_state_by_ieee(
        self,
        ieee_address: str,
        *,
        brightness: int | None = None,
        color_temp: int | None = None,
        hue: int | None = None,
        saturation: int | None = None,
        color_mode: str | None = None,
        session: Session,
    ) -> int:
        values: dict = {"updated_at": datetime.now(timezone.utc)}
        if brightness is not None:
            values["brightness"] = brightness
        if color_temp is not None:
            values["color_temp"] = color_temp
        if hue is not None:
            values["hue"] = hue
        if saturation is not None:
            values["saturation"] = saturation
        if color_mode is not None:
            values["color_mode"] = color_mode
        if len(values) == 1:
            return 0
        result = session.execute(update(Device).where(Device.ieee_address == ieee_address).values(**values))
        return result.rowcount

    @staticmethod
    def _availability_values(available: bool) -> dict:
        now = datetime.now(timezone.utc)
        if available:
            return {"available": True, "last_seen": now, "updated_at": now}
        return {"available": False, "updated_at": now}

    def mark_unavailable_not_in(self, active_addresses: list[str], session: Session) -> int:
        stmt = update(Device).values(available=False)
        if active_addresses:
            stmt = stmt.where(Device.ieee_address.not_in(active_addresses))
        return session.execute(stmt).rowcount


device_repository = DeviceRepository()
