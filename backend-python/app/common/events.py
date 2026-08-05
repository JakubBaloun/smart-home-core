"""Minimal synchronous in-process event bus.

Stands in for CDI `Event<T>` / `@Observes`: publishers stay decoupled from the
automation module, which subscribes at startup (see automation.bridge).
"""

from collections import defaultdict
from collections.abc import Callable
import logging

log = logging.getLogger(__name__)


class EventBus:
    def __init__(self) -> None:
        self._subscribers: dict[type, list[Callable[[object], None]]] = defaultdict(list)

    def subscribe(self, event_type: type, handler: Callable) -> None:
        # CDI registers one observer per method; re-registering must not double-fire.
        if handler not in self._subscribers[event_type]:
            self._subscribers[event_type].append(handler)

    def unsubscribe(self, event_type: type, handler: Callable) -> None:
        subscribers = self._subscribers.get(event_type)
        if subscribers and handler in subscribers:
            subscribers.remove(handler)

    def publish(self, event: object) -> None:
        for handler in self._subscribers[type(event)]:
            try:
                handler(event)
            except Exception:
                log.exception("Event handler failed for %s", type(event).__name__)

    def clear(self) -> None:
        self._subscribers.clear()


event_bus = EventBus()
