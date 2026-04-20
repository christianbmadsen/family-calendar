from datetime import datetime, timezone, timedelta
from typing import Optional
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


# ---------------------------------------------------------------------------
# Scheduler state persistence (missed-job detection)
# ---------------------------------------------------------------------------

def _record_run(job_id: str, run_time: datetime) -> None:
    db.collection("_scheduler_state").document(job_id).set({"last_run": run_time})


def _last_run(job_id: str) -> Optional[datetime]:
    doc = db.collection("_scheduler_state").document(job_id).get()
    if doc.exists:
        return doc.to_dict().get("last_run")
    return None


# ---------------------------------------------------------------------------
# Jobs
# ---------------------------------------------------------------------------

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

    _record_run("daily_digest", now)


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

    _record_run("weekly_digest", now)


# ---------------------------------------------------------------------------
# Missed-job recovery (runs once at startup)
# ---------------------------------------------------------------------------

def _check_missed_digests() -> None:
    now = datetime.now(timezone.utc)

    # Daily digest fires at 20:00 UTC — check if today's has been missed
    today_fire = now.replace(hour=20, minute=0, second=0, microsecond=0)
    if now >= today_fire:
        last = _last_run("daily_digest")
        if not last or last < today_fire:
            print("[scheduler] running missed daily digest")
            _daily_digest()

    # Weekly digest fires Sunday 18:00 UTC — find the most recent Sunday
    # Python weekday(): Mon=0 … Sun=6
    days_since_sunday = (now.weekday() + 1) % 7
    last_sunday = now - timedelta(days=days_since_sunday)
    last_sunday_fire = last_sunday.replace(hour=18, minute=0, second=0, microsecond=0)
    if now >= last_sunday_fire:
        last = _last_run("weekly_digest")
        if not last or last < last_sunday_fire:
            print("[scheduler] running missed weekly digest")
            _weekly_digest()


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

def start_scheduler() -> None:
    _check_missed_digests()
    scheduler.add_job(_pre_event_reminders, "interval", minutes=1, id="pre_event")
    scheduler.add_job(_daily_digest, "cron", hour=20, minute=0, id="daily_digest")
    scheduler.add_job(_weekly_digest, "cron", day_of_week="sun", hour=18, minute=0, id="weekly_digest")
    scheduler.start()


def stop_scheduler() -> None:
    scheduler.shutdown()
