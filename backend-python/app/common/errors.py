"""Equivalent of GlobalExceptionHandler plus the Quarkus built-in mappers.

Response shapes follow what the Quarkus backend actually emits:
  * ErrorResponse  -> {"title", "detail", "status"}  (custom mappers)
  * ViolationReport-> {"title": "Constraint Violation", "status", "violations"}
    (Hibernate Validator failures, produced by Quarkus, not by our code)
"""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response

from app.common.exceptions import (
    BadRequestError,
    DeviceUnavailableError,
    ResourceNotFoundError,
)

log = logging.getLogger(__name__)


def _error(title: str, detail: str, status: int) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"title": title, "detail": detail, "status": status},
    )


def _camel(name: str) -> str:
    head, *tail = name.split("_")
    return head + "".join(word.capitalize() for word in tail)


def _violation_field(request: Request, loc: tuple[object, ...]) -> str:
    """Hibernate Validator reports the full method-parameter path, e.g.
    `createRecipe.request.steps[0].timerSeconds`. All annotated resource methods
    name their body parameter `request`."""
    path = ""
    for part in loc:
        if part in ("body", "query"):
            continue
        if isinstance(part, int):
            path += f"[{part}]"
        else:
            path += f".{part}" if path else str(part)

    route = request.scope.get("route")
    if route is None or not getattr(route, "name", None):
        return path
    return f"{_camel(route.name)}.request" + (f".{path}" if path else "")


def _violation_message(message: str) -> str:
    # Pydantic prefixes messages raised from validators.
    return message.removeprefix("Value error, ")


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(ResourceNotFoundError)
    async def _not_found(_: Request, exc: ResourceNotFoundError) -> JSONResponse:
        return _error("Not Found", str(exc), 404)

    @app.exception_handler(DeviceUnavailableError)
    async def _unavailable(_: Request, exc: DeviceUnavailableError) -> JSONResponse:
        return _error("Device Unavailable", str(exc), 409)

    @app.exception_handler(BadRequestError)
    async def _bad_request(_: Request, exc: BadRequestError) -> JSONResponse:
        return _error("Bad Request", str(exc), 400)

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> Response:
        errors = exc.errors()
        # JAX-RS turns an unconvertible @PathParam into a 404, not a 400.
        if any(err["loc"] and err["loc"][0] == "path" for err in errors):
            return Response(status_code=404)
        return JSONResponse(
            status_code=400,
            content={
                "title": "Constraint Violation",
                "status": 400,
                "violations": [
                    {
                        "field": _violation_field(request, err["loc"]),
                        "message": _violation_message(err["msg"]),
                    }
                    for err in errors
                ],
            },
        )
