class ResourceNotFoundError(Exception):
    def __init__(self, resource_type: str, resource_id: object) -> None:
        super().__init__(f"{resource_type} with id '{resource_id}' not found")
        self.resource_type = resource_type
        self.resource_id = resource_id


class DeviceUnavailableError(Exception):
    def __init__(self, friendly_name: str) -> None:
        super().__init__(f"Device '{friendly_name}' is not available")
        self.friendly_name = friendly_name


class BadRequestError(Exception):
    """Equivalent of jakarta.ws.rs.BadRequestException."""


class TelemetryError(Exception):
    pass
