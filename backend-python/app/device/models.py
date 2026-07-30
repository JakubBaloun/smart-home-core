from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import BigInteger, Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class DeviceType(str, Enum):
    LIGHT = "LIGHT"
    SENSOR = "SENSOR"
    SWITCH = "SWITCH"
    PLUG = "PLUG"
    OTHER = "OTHER"


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Device(Base):
    __tablename__ = "device"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ieee_address: Mapped[str] = mapped_column(String(24), nullable=False, unique=True)
    friendly_name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column("type", String(50), nullable=False, default=DeviceType.OTHER.value)
    vendor: Mapped[str | None] = mapped_column(String(255))
    model: Mapped[str | None] = mapped_column(String(255))
    available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
