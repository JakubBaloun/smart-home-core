from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator

from app.common.datetimes import OffsetDateTime
from app.device.models import DeviceType


class DeviceResponse(BaseModel):
    id: int
    ieeeAddress: str
    friendlyName: str
    type: DeviceType
    vendor: str | None
    model: str | None
    available: bool
    lastSeen: OffsetDateTime | None
    createdAt: OffsetDateTime
    updatedAt: OffsetDateTime
    state: str | None
    brightness: int | None
    colorTemp: int | None

    # 'model' collides with Pydantic's protected namespace, which is only a warning.
    model_config = ConfigDict(protected_namespaces=())


class UpdateDeviceRequest(BaseModel):
    friendlyName: str
    type: DeviceType | None = None

    @field_validator("friendlyName")
    @classmethod
    def _validate_friendly_name(cls, v: str) -> str:
        if v is None or not v.strip():
            raise ValueError("friendlyName must not be blank")
        return v


class DeviceCommandRequest(BaseModel):
    command: str
    payload: dict[str, Any] | None = None

    @field_validator("command")
    @classmethod
    def _validate_command(cls, v: str) -> str:
        if v is None or not v.strip():
            raise ValueError("must not be blank")
        return v


class Z2MDefinition(BaseModel):
    description: str | None = None
    model: str | None = None
    vendor: str | None = None

    model_config = ConfigDict(protected_namespaces=())


class Z2MDevicePayload(BaseModel):
    ieee_address: str | None = None
    friendly_name: str | None = None
    type: str | None = None
    vendor: str | None = None
    model: str | None = None
    definition: Z2MDefinition | None = None
    exposes: list[dict] | None = None

    model_config = ConfigDict(protected_namespaces=())
