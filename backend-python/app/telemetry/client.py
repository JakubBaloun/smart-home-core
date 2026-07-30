"""Mirror of InfluxDbProducer — one client, write + query API."""

import logging

from influxdb_client import InfluxDBClient
from influxdb_client.client.write_api import SYNCHRONOUS

from app.config import get_settings

log = logging.getLogger(__name__)

_client: InfluxDBClient | None = None


def init_client() -> InfluxDBClient:
    global _client
    if _client is None:
        settings = get_settings()
        _client = InfluxDBClient(
            url=settings.influxdb_url,
            token=settings.influxdb_token,
            org=settings.influxdb_org,
        )
        log.info("InfluxDB client created for %s", settings.influxdb_url)
    return _client


def get_client() -> InfluxDBClient:
    if _client is None:
        return init_client()
    return _client


def get_write_api():
    return get_client().write_api(write_options=SYNCHRONOUS)


def get_query_api():
    return get_client().query_api()


def close_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
