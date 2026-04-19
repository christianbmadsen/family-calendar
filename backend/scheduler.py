from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from firebase import db
from services.notifications import (
    notify_family,
    fmt_pre_event,
    fmt_daily_digest,
    fmt_weekly_digest,
)

scheduler = BackgroundScheduler(timezone="UTC")

_reminded: set[str] = set()


def _pre_event_reminders() -> None:
    now = datetime.now(timezone.utc)
    window_start = now + timedelta(minutes=25)
    window_end = now + timedelta(minutes=35)

    docs = (
        db.collection("events")
        .where("start_datetime", ">=", window_start)
        .where("start_datetime", "<=", window_end)
        .get()
    )

    for doc in docs:
        event = doc.to_dict()
        if event["id"] in _reminded:
            continue
        title, body = fmt_pre_event(event["title"], event.get("location"))
        notify_family(event["family_id"], title, body, include_email=False)
        _reminded.add(event["id"])


def _daily_digest() -> None:
    now = datetime.now(timezone.utc)
    tomorrow_start = (now + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    tomorrow_end = tomorrow_start + timedelta(days=1)

    for fam_doc in db.collection("families").get():
        family_id = fam_doc.id
        events = (
            db.collection("events")
            .where("family_id", "==", family_id)
            .where("start_datetime", ">=", tomorrow_start)
            .where("start_datetime", "<", tomorrow_end)
            .order_by("start_datetime")
            .get()
        )
        title, body = fmt_daily_digest([e.to_dict() for e in events])
        notify_family(family_id, title, body, include_email=True)


def _weekly_digest() -> None:
    now = datetime.now(timezone.utc)
    week_start = (now + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    week_end = week_start + timedelta(days=7)

    for fam_doc in db.collection("families").get():
        family_id = fam_doc.id
        events = (
            db.collection("events")
            .where("family_id", "==", family_id)
            .where("start_datetime", ">=", week_start)
            .where("start_datetime", "<", week_end)
            .order_by("start_datetime")
            .get()
        )
        days: dict[str, list[dict]] = {}
        for e in events:
            event = e.to_dict()
            if event.get("start_datetime"):
                day_label = event["start_datetime"].strftime("%A %-d %b")
            else:
                day_label = "All week"
            days.setdefault(day_label, []).append(event)

        title, body = fmt_weekly_digest(days)
        notify_family(family_id, title, body, include_email=True)


def start_scheduler() -> None:
    scheduler.add_job(_pre_event_reminders, "interval", minutes=1, id="pre_event")
    scheduler.add_job(_daily_digest, "cron", hour=20, minute=0, id="daily_digest")
    scheduler.add_job(_weekly_digest, "cron", day_of_week="sun", hour=18, minute=0, id="weekly_digest")
    scheduler.start()


def stop_scheduler() -> None:
    scheduler.shutdown()
