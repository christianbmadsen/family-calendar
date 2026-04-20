from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from firebase import db

router = APIRouter(prefix="/ical", tags=["ical"])


def _dt(dt: datetime) -> str:
    return dt.strftime("%Y%m%dT%H%M%SZ")


def _esc(text: str) -> str:
    return text.replace("\\", "\\\\").replace("\n", "\\n").replace(",", "\\,").replace(";", "\\;")


def _fold(line: str) -> str:
    """Fold long lines per RFC 5545 (max 75 octets, continuation with CRLF + space)."""
    encoded = line.encode("utf-8")
    if len(encoded) <= 75:
        return line
    chunks = []
    pos = 0
    limit = 75
    while pos < len(encoded):
        chunks.append(encoded[pos:pos + limit].decode("utf-8", errors="ignore"))
        pos += limit
        limit = 74  # continuation lines start with a space (1 octet)
    return "\r\n ".join(chunks)


@router.get("/{family_id}/{token}")
def get_ical(family_id: str, token: str):
    family_doc = db.collection("families").document(family_id).get()
    if not family_doc.exists:
        raise HTTPException(status_code=404)

    family = family_doc.to_dict()
    if family.get("ical_token") != token:
        raise HTTPException(status_code=403)

    events = db.collection("events").where("family_id", "==", family_id).get()
    now_str = _dt(datetime.now(timezone.utc))

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Family Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{_esc(family.get('name', 'Family Calendar'))}",
    ]

    for doc in events:
        e = doc.to_dict()
        start = e.get("start_datetime")
        if not start:
            continue

        end = e.get("end_datetime")
        lines += [
            "BEGIN:VEVENT",
            f"UID:{e['id']}@family-calendar",
            f"DTSTAMP:{now_str}",
        ]

        if e.get("is_all_day"):
            lines.append(f"DTSTART;VALUE=DATE:{start.strftime('%Y%m%d')}")
            # DTEND for all-day must be the exclusive end date (day after)
            lines.append(f"DTEND;VALUE=DATE:{(start + timedelta(days=1)).strftime('%Y%m%d')}")
        else:
            lines.append(f"DTSTART:{_dt(start)}")
            lines.append(f"DTEND:{_dt(end) if end else _dt(start)}")

        lines.append(_fold(f"SUMMARY:{_esc(e.get('title', ''))}"))
        if e.get("description"):
            lines.append(_fold(f"DESCRIPTION:{_esc(e['description'])}"))
        if e.get("location"):
            lines.append(_fold(f"LOCATION:{_esc(e['location'])}"))

        lines.append("END:VEVENT")

    lines.append("END:VCALENDAR")

    return Response(
        content="\r\n".join(lines),
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="family-calendar.ics"'},
    )
