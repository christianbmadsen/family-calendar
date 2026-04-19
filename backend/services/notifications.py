import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from firebase import db
from config import settings


def send_email(to: str, subject: str, body: str) -> None:
    msg = MIMEMultipart()
    msg["From"] = settings.gmail_address
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(settings.gmail_address, settings.gmail_app_password)
        server.send_message(msg)


def notify_family(
    family_id: str,
    title: str,
    message: str,
    data: dict | None = None,
    include_email: bool = True,
) -> None:
    if not include_email:
        return

    member_docs = db.collection("users").where("family_id", "==", family_id).get()

    for doc in member_docs:
        member = doc.to_dict()
        if member.get("notify_email") and member.get("email"):
            try:
                send_email(member["email"], title, message)
            except Exception as exc:
                print(f"[notifications] email failed for {member.get('id')}: {exc}")


def fmt_pre_event(event_title: str, location: str | None) -> tuple[str, str]:
    title = f"Starting in 30 min: {event_title}"
    body = f"Location: {location}" if location else ""
    return title, body


def fmt_daily_digest(events: list[dict]) -> tuple[str, str]:
    title = "Tomorrow's schedule"
    if not events:
        return title, "No events tomorrow — enjoy the free day!"

    lines = []
    for e in events:
        if e.get("start_datetime"):
            time_str = e["start_datetime"].strftime("%H:%M")
            lines.append(f"{time_str}  {e['title']}")
        else:
            lines.append(f"All day  {e['title']}")
        if e.get("location"):
            lines.append(f"         {e['location']}")

    return title, "\n".join(lines)


def fmt_weekly_digest(days: dict[str, list[dict]]) -> tuple[str, str]:
    title = "This week"
    if not days:
        return title, "No events this week — a great week to plan something!"

    lines = []
    for day_label, events in days.items():
        if events:
            lines.append(f"\n{day_label}")
            for e in events:
                if e.get("start_datetime"):
                    time_str = e["start_datetime"].strftime("%H:%M")
                    lines.append(f"  {time_str}  {e['title']}")
                else:
                    lines.append(f"  All day  {e['title']}")

    return title, "\n".join(lines) if lines else "No events this week."
