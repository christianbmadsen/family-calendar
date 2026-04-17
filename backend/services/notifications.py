import httpx
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from firebase import db
from config import settings

EXPO_PUSH_URL = "https://exp.host/--/expo-notifications/send"


# ---------------------------------------------------------------------------
# Low-level senders
# ---------------------------------------------------------------------------

def send_email(to: str, subject: str, body: str) -> None:
    msg = MIMEMultipart()
    msg["From"] = settings.gmail_address
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(settings.gmail_address, settings.gmail_app_password)
        server.send_message(msg)


def send_push(tokens: list[str], title: str, body: str, data: dict | None = None) -> None:
    if not tokens:
        return

    messages = [
        {"to": token, "title": title, "body": body, "data": data or {}}
        for token in tokens
    ]

    with httpx.Client() as client:
        response = client.post(
            EXPO_PUSH_URL,
            json=messages,
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            timeout=10,
        )
        response.raise_for_status()

    results = response.json().get("data", [])
    stale_tokens = {
        messages[i]["to"]
        for i, result in enumerate(results)
        if result.get("status") == "error"
        and result.get("details", {}).get("error") == "DeviceNotRegistered"
    }
    if stale_tokens:
        _remove_stale_tokens(stale_tokens)


def _remove_stale_tokens(stale: set[str]) -> None:
    users = db.collection("users").where("push_tokens", "array_contains_any", list(stale)).get()
    for doc in users:
        current = doc.to_dict().get("push_tokens", [])
        updated = [t for t in current if t not in stale]
        doc.reference.update({"push_tokens": updated})


# ---------------------------------------------------------------------------
# Family-wide notification
#
# send_email controls whether email is sent in addition to push.
# Use send_email=False for high-frequency or in-app-only triggers.
# ---------------------------------------------------------------------------

def notify_family(
    family_id: str,
    title: str,
    message: str,
    data: dict | None = None,
    include_email: bool = True,
) -> None:
    member_docs = db.collection("users").where("family_id", "==", family_id).get()

    all_push_tokens: list[str] = []

    for doc in member_docs:
        member = doc.to_dict()

        if member.get("notify_push"):
            all_push_tokens.extend(member.get("push_tokens", []))

        if include_email and member.get("notify_email") and member.get("email"):
            try:
                send_email(member["email"], title, message)
            except Exception as exc:
                print(f"[notifications] email failed for {member['id']}: {exc}")

    if all_push_tokens:
        try:
            send_push(all_push_tokens, title, message, data)
        except Exception as exc:
            print(f"[notifications] push failed for family {family_id}: {exc}")


# ---------------------------------------------------------------------------
# Notification formatters
# ---------------------------------------------------------------------------

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


def fmt_agent_suggestions(suggestion_type: str, count: int) -> tuple[str, str]:
    if suggestion_type == "opportunity":
        title = f"{count} new local event{'s' if count != 1 else ''} found"
        body = "Open the app to review and add to your calendar."
    else:
        title = f"{count} travel deal{'s' if count != 1 else ''} available"
        body = "Open the app to review flight deals for your free dates."
    return title, body


def fmt_suggestion_accepted(member_name: str, event_title: str) -> tuple[str, str]:
    title = f"{member_name} added an event"
    body = event_title
    return title, body
