"""Replacement for @Scheduled(cron = "0 0 0 * * ?", timeZone = "Europe/Prague")
on NightModeRule.trigger()."""

import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.automation.context import RuleContext
from app.automation.engine import rule_engine
from app.config import get_settings

log = logging.getLogger(__name__)

TIMEZONE = ZoneInfo("Europe/Prague")

_scheduler: BackgroundScheduler | None = None


def trigger_night_mode() -> None:
    context = RuleContext(
        event_type="schedule",
        device_id="night-mode",
        data={},
        timestamp=datetime.now(timezone.utc),
    )
    try:
        rule_engine.fire(context)
    except Exception:
        log.exception("Night mode schedule dispatch failed")


def start() -> None:
    global _scheduler
    if not get_settings().scheduler_enabled:
        log.info("Scheduler is disabled")
        return
    _scheduler = BackgroundScheduler(timezone=TIMEZONE)
    _scheduler.add_job(
        trigger_night_mode,
        CronTrigger(hour=0, minute=0, second=0, timezone=TIMEZONE),
        id="night-mode",
    )
    _scheduler.start()
    log.info("Scheduler started (night-mode at 00:00 Europe/Prague)")


def stop() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
