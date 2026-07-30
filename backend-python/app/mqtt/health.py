"""Mirror of ZigbeeBridgeHealthCheck plus the SmallRye Health endpoints it is
exposed through (/q/health, /q/health/ready, /q/health/live)."""

from fastapi import APIRouter, Response
from fastapi.responses import JSONResponse

from app.mqtt.bridge_state import BridgeState, bridge_state_holder

health_router = APIRouter(tags=["health"])


def _bridge_check() -> dict:
    state = bridge_state_holder.state
    data = {"state": state.value.lower()}
    last_change = bridge_state_holder.last_change
    if last_change is not None:
        data["lastChange"] = last_change.isoformat().replace("+00:00", "Z")
    # UNKNOWN stays UP so a quiet bridge doesn't block app readiness at startup
    return {
        "name": "zigbee2mqtt-bridge",
        "status": "UP" if state != BridgeState.OFFLINE else "DOWN",
        "data": data,
    }


def _report(checks: list[dict]) -> Response:
    status = "UP" if all(c["status"] == "UP" for c in checks) else "DOWN"
    return JSONResponse(
        status_code=200 if status == "UP" else 503,
        content={"status": status, "checks": checks},
    )


@health_router.get("/q/health")
def health() -> Response:
    return _report([_bridge_check()])


@health_router.get("/q/health/ready")
def health_ready() -> Response:
    return _report([_bridge_check()])


@health_router.get("/q/health/live")
def health_live() -> Response:
    return _report([])
