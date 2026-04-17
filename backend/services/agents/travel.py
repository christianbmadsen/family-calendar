# Requires a free Amadeus Developer account (developers.amadeus.com).
# Add AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET to your .env file.

import json
import uuid
import httpx
from datetime import datetime, timezone, timedelta, date
from firebase import db
from services.agents.claude import get_client, MODEL
from services.notifications import notify_family, fmt_agent_suggestions
from config import settings

AMADEUS_AUTH_URL = "https://test.api.amadeus.com/v1/security/oauth2/token"
AMADEUS_INSPIRATION_URL = "https://test.api.amadeus.com/v1/shopping/flight-destinations"
MAX_SUGGESTIONS = 5


# ---------------------------------------------------------------------------
# Free window calculation (3+ consecutive free days)
# ---------------------------------------------------------------------------

def _find_free_windows(family_id: str, days: int = 90) -> list[dict]:
    now = datetime.now(timezone.utc).date()
    end = now + timedelta(days=days)

    docs = (
        db.collection("events")
        .where("family_id", "==", family_id)
        .where("start_datetime", ">=", datetime(now.year, now.month, now.day, tzinfo=timezone.utc))
        .where("start_datetime", "<=", datetime(end.year, end.month, end.day, tzinfo=timezone.utc))
        .get()
    )

    busy_dates: set[date] = set()
    for doc in docs:
        event = doc.to_dict()
        if event.get("start_datetime"):
            busy_dates.add(event["start_datetime"].date())
        if event.get("end_datetime"):
            busy_dates.add(event["end_datetime"].date())

    # Find runs of 3+ consecutive free days
    windows = []
    current_start = None
    current_len = 0

    for i in range(days):
        day = now + timedelta(days=i)
        if day not in busy_dates:
            if current_start is None:
                current_start = day
            current_len += 1
        else:
            if current_len >= 3:
                windows.append({
                    "departure": current_start.isoformat(),
                    "return": (current_start + timedelta(days=current_len - 1)).isoformat(),
                    "nights": current_len - 1,
                })
            current_start = None
            current_len = 0

    if current_len >= 3:
        windows.append({
            "departure": current_start.isoformat(),
            "return": (current_start + timedelta(days=current_len - 1)).isoformat(),
            "nights": current_len - 1,
        })

    return windows


# ---------------------------------------------------------------------------
# Amadeus API
# ---------------------------------------------------------------------------

def _get_amadeus_token() -> str:
    with httpx.Client() as client:
        response = client.post(
            AMADEUS_AUTH_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": settings.amadeus_client_id,
                "client_secret": settings.amadeus_client_secret,
            },
            timeout=10,
        )
        response.raise_for_status()
    return response.json()["access_token"]


def _search_flight_inspiration(origin: str, departure_date: str, token: str) -> list[dict]:
    with httpx.Client() as client:
        response = client.get(
            AMADEUS_INSPIRATION_URL,
            params={
                "origin": origin,
                "departureDate": departure_date,
                "oneWay": "false",
                "duration": "3,14",
                "nonStop": "false",
                "maxPrice": 1500,
                "viewBy": "DATE",
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        response.raise_for_status()

    return response.json().get("data", [])


def _search_deals_for_windows(origin: str, windows: list[dict]) -> list[dict]:
    if not windows:
        return []

    token = _get_amadeus_token()
    all_deals = []

    for window in windows[:5]:  # limit API calls
        try:
            deals = _search_flight_inspiration(origin, window["departure"], token)
            for deal in deals:
                all_deals.append({
                    "origin": origin,
                    "destination": deal.get("destination"),
                    "departure_date": deal.get("departureDate"),
                    "return_date": deal.get("returnDate"),
                    "price": deal.get("price", {}).get("total"),
                    "currency": "USD",
                    "links": deal.get("links", {}),
                })
        except Exception as exc:
            print(f"[travel] Amadeus search failed for window {window}: {exc}")

    return all_deals


# ---------------------------------------------------------------------------
# Claude curation
# ---------------------------------------------------------------------------

def _curate_with_claude(
    origin: str, deals: list[dict], windows: list[dict]
) -> list[dict]:
    client = get_client()

    windows_desc = "\n".join(
        f"  - {w['departure']} to {w['return']} ({w['nights']} nights free)"
        for w in windows
    )

    prompt = f"""You are helping a family find travel deals from their home airport.

Home airport: {origin}
Today: {datetime.now(timezone.utc).strftime('%Y-%m-%d')}

Free windows available for travel:
{windows_desc}

Flight deals found:
{json.dumps(deals, indent=2, default=str)}

Select the {MAX_SUGGESTIONS} most appealing deals that fit within the free windows.
Prioritize variety of destinations and good value.
Return ONLY a JSON array with exactly this structure per item:
{{
  "title": "e.g. Weekend in Barcelona — Mar 15-18",
  "description": "2-3 sentences about why this destination is worth visiting",
  "start_datetime": "ISO 8601 departure datetime",
  "end_datetime": "ISO 8601 return datetime",
  "location": "destination city and country",
  "price": "e.g. From $320 round trip",
  "source_url": "booking URL if available, else empty string"
}}"""

    message = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    text = message.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]

    return json.loads(text)


# ---------------------------------------------------------------------------
# Main agent entry point
# ---------------------------------------------------------------------------

def run_travel_agent(family_id: str) -> None:
    family_doc = db.collection("families").document(family_id).get()
    if not family_doc.exists:
        return

    family = family_doc.to_dict()
    home_airport = family.get("home_airport", "")

    if not home_airport:
        print(f"[travel] family {family_id} has no home_airport set")
        return

    windows = _find_free_windows(family_id, days=90)
    if not windows:
        return

    try:
        deals = _search_deals_for_windows(home_airport, windows)
    except Exception as exc:
        print(f"[travel] deal search failed: {exc}")
        return

    if not deals:
        return

    try:
        suggestions = _curate_with_claude(home_airport, deals, windows)
    except Exception as exc:
        print(f"[travel] Claude curation failed: {exc}")
        return

    # Replace existing pending travel suggestions
    existing = (
        db.collection("suggestions")
        .where("family_id", "==", family_id)
        .where("type", "==", "travel_deal")
        .where("status", "==", "pending")
        .get()
    )
    for doc in existing:
        doc.reference.delete()

    now = datetime.now(timezone.utc)
    for item in suggestions[:MAX_SUGGESTIONS]:
        suggestion_id = str(uuid.uuid4())
        db.collection("suggestions").document(suggestion_id).set({
            "id": suggestion_id,
            "family_id": family_id,
            "type": "travel_deal",
            "title": item["title"],
            "description": item["description"],
            "start_datetime": datetime.fromisoformat(item["start_datetime"]),
            "end_datetime": datetime.fromisoformat(item["end_datetime"]),
            "location": item.get("location"),
            "price": item.get("price"),
            "source_url": item.get("source_url"),
            "source": "google_flights",
            "status": "pending",
            "created_at": now,
        })

    title, body = fmt_agent_suggestions("travel_deal", len(suggestions[:MAX_SUGGESTIONS]))
    notify_family(family_id, title, body, data={"type": "agent_travel"})
