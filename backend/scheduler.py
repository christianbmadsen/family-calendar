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

# Tracks which events have already had a pre-event reminder sent this session.
# Stored as a set of event IDs to avoid double-sending within the same window.
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
        notify_family(
            event["family_id"],
            title,
            body,
            data={"event_id": event["id"], "type": "pre_event"},
            include_email=False,  # push only — too frequent for email
        )
        _reminded.add(event["id"])


def _daily_digest() -> None:
    now = datetime.now(timezone.utc)
    tomorrow_start = (now + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    tomorrow_end = tomorrow_start + timedelta(days=1)

    family_docs = db.collection("families").get()

    for fam_doc in family_docs:
        family_id = fam_doc.id

        events = (
            db.collection("events")
            .where("family_id", "==", family_id)
            .where("start_datetime", ">=", tomorrow_start)
            .where("start_datetime", "<", tomorrow_end)
            .order_by("start_datetime")
            .get()
        )

        event_list = [e.to_dict() for e in events]
        title, body = fmt_daily_digest(event_list)
        notify_family(family_id, title, body, data={"type": "daily_digest"}, include_email=True)


def _weekly_digest() -> None:
    now = datetime.now(timezone.utc)
    week_start = (now + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    week_end = week_start + timedelta(days=7)

    family_docs = db.collection("families").get()

    for fam_doc in family_docs:
        family_id = fam_doc.id

        events = (
            db.collection("events")
            .where("family_id", "==", family_id)
            .where("start_datetime", ">=", week_start)
            .where("start_datetime", "<", week_end)
            .order_by("start_datetime")
            .get()
        )

        # Group by day label
        days: dict[str, list[dict]] = {}
        for e in events:
            event = e.to_dict()
            if event.get("start_datetime"):
                day_label = event["start_datetime"].strftime("%A %-d %b")
            else:
                day_label = "All week"
            days.setdefault(day_label, []).append(event)

        title, body = fmt_weekly_digest(days)
        notify_family(family_id, title, body, data={"type": "weekly_digest"}, include_email=True)


def _run_agents() -> None:
    from services.agents.opportunity import run_opportunity_agent
    from services.agents.travel import run_travel_agent

    family_docs = db.collection("families").get()
    for fam_doc in family_docs:
        family_id = fam_doc.id
        try:
            run_opportunity_agent(family_id)
        except Exception as exc:
            print(f"[scheduler] opportunity agent failed for {family_id}: {exc}")
        try:
            run_travel_agent(family_id)
        except Exception as exc:
            print(f"[scheduler] travel agent failed for {family_id}: {exc}")


def start_scheduler() -> None:
    scheduler.add_job(_pre_event_reminders, "interval", minutes=1, id="pre_event")
    scheduler.add_job(_daily_digest, "cron", hour=20, minute=0, id="daily_digest")
    scheduler.add_job(_weekly_digest, "cron", day_of_week="sun", hour=18, minute=0, id="weekly_digest")
    scheduler.add_job(_run_agents, "cron", day_of_week="mon", hour=9, minute=0, id="agents")
    scheduler.start()


def stop_scheduler() -> None:
    scheduler.shutdown()
