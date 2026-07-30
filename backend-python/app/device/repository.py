"""Mirror of DeviceRepository."""

from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.device.models import Device, DeviceType


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
        now = datetime.now(timezone.utc)
        if available:
            values = {"available": True, "last_seen": now, "updated_at": now}
        else:
            values = {"available": False, "updated_at": now}
        result = session.execute(
            update(Device).where(Device.friendly_name == friendly_name).values(**values)
        )
        return result.rowcount

    def mark_unavailable_not_in(self, active_addresses: list[str], session: Session) -> int:
        stmt = update(Device).values(available=False)
        if active_addresses:
            stmt = stmt.where(Device.ieee_address.not_in(active_addresses))
        return session.execute(stmt).rowcount


device_repository = DeviceRepository()
