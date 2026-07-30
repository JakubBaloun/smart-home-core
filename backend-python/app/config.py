"""Equivalent of backend/src/main/resources/application.yaml.

Defaults match the Quarkus `%dev` profile, so the app runs against
docker-compose.dev.yaml with no exported variables.
"""

from functools import lru_cache

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class NightModeConfig(BaseModel):
    enabled: bool = True
    lights: list[str] = Field(default_factory=list)


class DoorOpenedLightsConfig(BaseModel):
    enabled: bool = True
    door_sensor: str = "front_door_sensor"
    lights: list[str] = Field(default_factory=lambda: ["hallway_light"])


class TemperatureAlertConfig(BaseModel):
    enabled: bool = True
    device: str | None = None
    threshold: float = 30.0


class AutomationConfig(BaseModel):
    night_mode: NightModeConfig = Field(default_factory=NightModeConfig)
    door_opened_lights: DoorOpenedLightsConfig = Field(default_factory=DoorOpenedLightsConfig)
    temperature_alert: TemperatureAlertConfig = Field(default_factory=TemperatureAlertConfig)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_nested_delimiter="__", extra="ignore")

    http_port: int = Field(default=8081, alias="HTTP_PORT")

    db_host: str = Field(default="localhost", alias="DB_HOST")
    db_port: int = Field(default=5433, alias="DB_PORT")
    db_name: str = Field(default="smarthome", alias="DB_NAME")
    db_username: str = Field(default="smarthome", alias="DB_USERNAME")
    db_password: str = Field(default="smarthome", alias="DB_PASSWORD")
    db_url: str | None = Field(default=None, alias="DB_URL")

    influxdb_url: str = Field(default="http://localhost:8086", alias="INFLUXDB_URL")
    influxdb_token: str = Field(default="dev-token", alias="INFLUXDB_TOKEN")
    influxdb_org: str = Field(default="smart-home", alias="INFLUXDB_ORG")
    influxdb_bucket: str = Field(default="telemetry", alias="INFLUXDB_BUCKET")

    mqtt_enabled: bool = Field(default=True, alias="MQTT_ENABLED")
    mqtt_host: str = Field(default="localhost", alias="MQTT_HOST")
    mqtt_port: int = Field(default=1883, alias="MQTT_PORT")
    # Must differ from the Quarkus client ids (smart-home-core-*) so both
    # backends can subscribe to the same topics at the same time.
    mqtt_client_id: str = Field(default="smart-home-py", alias="MQTT_CLIENT_ID")
    mqtt_keep_alive_seconds: int = Field(default=60, alias="MQTT_KEEP_ALIVE_SECONDS")

    scheduler_enabled: bool = Field(default=True, alias="SCHEDULER_ENABLED")
    schema_check_enabled: bool = Field(default=True, alias="SCHEMA_CHECK_ENABLED")

    automation: AutomationConfig = Field(default_factory=AutomationConfig)

    @property
    def sqlalchemy_url(self) -> str:
        if self.db_url:
            return self.db_url
        return (
            f"postgresql+psycopg://{self.db_username}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
