# Requires a free Ticketmaster Developer account (developer.ticketmaster.com).
# Add TICKETMASTER_API_KEY to your .env file.

import json
import uuid
import httpx
from datetime import datetime, timezone, timedelta
from firebase import db
from services.agents.claude import get_client, MODEL
from services.notifications import notify_family, fmt_agent_suggestions
from config import settings

TICKETMASTER_URL = "https://app.ticketmaster.com/discovery/v2/events.json"
MAX_SUGGESTIONS = 5


# ---------------------------------------------------------------------------
# Free slot calculation
# ---------------------------------------------------------------------------

def _get_busy_intervals(family_id: str, days: int) -> list[dict]:
    now = datetime.now(timezone.utc)
    end = now + timedelta(days=days)
    docs = (
        db.collection("events")
        .where("family_id", "==", family_id)
        .where("start_datetime", ">=", now)
        .where("start_datetime", "<=", end)
        .order_by("start_datetime")
        .get()
    )
    return [
        {"start": d.to_dict()["start_datetime"], "end": d.to_dict().get("end_datetime")}
        for d in docs
        if d.to_dict().get("start_datetime") and d.to_dict().get("end_datetime")
    ]


def _describe_free_slots(busy: list[dict], days: int) -> str:
    now = datetime.now(timezone.utc)
    end = now + timedelta(days=days)

    if not busy:
        return f"Completely free for the next {days} days."

    lines = [f"Busy periods (UTC):"]
    for interval in busy:
        lines.append(
            f"  - {interval['start'].strftime('%b %-d %H:%M')} to "
            f"{interval['end'].strftime('%b %-d %H:%M')}"
        )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Ticketmaster search
# ---------------------------------------------------------------------------

def _search_ticketmaster(location: str, days: int) -> list[dict]:
    now = datetime.now(timezone.utc)
    end = now + timedelta(days=days)

    params = {
        "apikey": settings.ticketmaster_api_key,
        "city": location,
        "startDateTime": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "endDateTime": end.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "size": 50,
        "sort": "relevance,desc",
    }

    with httpx.Client() as client:
        response = client.get(TICKETMASTER_URL, params=params, timeout=15)
        response.raise_for_status()

    raw = response.json()
    events = raw.get("_embedded", {}).get("events", [])

    results = []
    for e in events:
        venue = {}
        venues = e.get("_embedded", {}).get("venues", [])
        if venues:
            venue = venues[0]

        start_info = e.get("dates", {}).get("start", {})
        results.append({
            "name": e.get("name"),
            "url": e.get("url"),
            "start_local": start_info.get("localDate"),
            "start_time": start_info.get("localTime"),
            "venue_name": venue.get("name"),
            "address": venue.get("address", {}).get("line1"),
            "city": venue.get("city", {}).get("name"),
            "genre": e.get("classifications", [{}])[0].get("genre", {}).get("name"),
        })

    return results


# ---------------------------------------------------------------------------
# Claude curation
# ---------------------------------------------------------------------------

def _curate_with_claude(location: str, events: list[dict], busy_desc: str) -> list[dict]:
    client = get_client()

    prompt = f"""You are helping a family discover local events and activities.

Location: {location}
Today: {datetime.now(timezone.utc).strftime('%Y-%m-%d')}

Family calendar (busy periods):
{busy_desc}

Upcoming events found near {location}:
{json.dumps(events, indent=2, default=str)}

Select the {MAX_SUGGESTIONS} most interesting and diverse suggestions that do NOT conflict with busy periods.
Return ONLY a JSON array with exactly this structure per item:
{{
  "title": "event name",
  "description": "2-3 engaging sentences about why the family would enjoy this",
  "start_datetime": "ISO 8601 datetime string",
  "end_datetime": "ISO 8601 datetime string (estimate 2 hours if unknown)",
  "location": "venue name and address",
  "source_url": "URL"
}}"""

    message = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    text = message.content[0].text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]

    return json.loads(text)


# ---------------------------------------------------------------------------
# Main agent entry point
# ---------------------------------------------------------------------------

def run_opportunity_agent(family_id: str) -> None:
    family_doc = db.collection("families").document(family_id).get()
    if not family_doc.exists:
        return

    family = family_doc.to_dict()
    location = family.get("home_location", "")

    if not location:
        print(f"[opportunity] family {family_id} has no home_location set")
        return

    # Fetch raw events
    try:
        raw_events = _search_ticketmaster(location, days=30)
    except Exception as exc:
        print(f"[opportunity] Ticketmaster search failed: {exc}")
        raw_events = []

    if not raw_events:
        return

    busy = _get_busy_intervals(family_id, days=30)
    busy_desc = _describe_free_slots(busy, days=30)

    # Curate with Claude
    try:
        suggestions = _curate_with_claude(location, raw_events, busy_desc)
    except Exception as exc:
        print(f"[opportunity] Claude curation failed: {exc}")
        return

    # Replace existing pending opportunity suggestions
    existing = (
        db.collection("suggestions")
        .where("family_id", "==", family_id)
        .where("type", "==", "opportunity")
        .where("status", "==", "pending")
        .get()
    )
    for doc in existing:
        doc.reference.delete()

    # Store new suggestions
    now = datetime.now(timezone.utc)
    for item in suggestions[:MAX_SUGGESTIONS]:
        suggestion_id = str(uuid.uuid4())
        db.collection("suggestions").document(suggestion_id).set({
            "id": suggestion_id,
            "family_id": family_id,
            "type": "opportunity",
            "title": item["title"],
            "description": item["description"],
            "start_datetime": datetime.fromisoformat(item["start_datetime"]),
            "end_datetime": datetime.fromisoformat(item["end_datetime"]),
            "location": item.get("location"),
            "price": None,
            "source_url": item.get("source_url"),
            "source": "google_events",
            "status": "pending",
            "created_at": now,
        })

    title, body = fmt_agent_suggestions("opportunity", len(suggestions[:MAX_SUGGESTIONS]))
    notify_family(family_id, title, body, data={"type": "agent_opportunity"})
