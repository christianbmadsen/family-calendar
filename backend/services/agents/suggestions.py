import json
import uuid
from datetime import datetime, timezone, timedelta
from firebase import db
from services.agents.claude import get_client, MODEL


def run_suggestions_agent(family_id: str) -> None:
    family_doc = db.collection("families").document(family_id).get()
    if not family_doc.exists:
        return

    family = family_doc.to_dict()
    location = family.get("home_location") or "your area"

    now = datetime.now(timezone.utc)
    end = now + timedelta(days=30)

    event_docs = (
        db.collection("events")
        .where("family_id", "==", family_id)
        .where("start_datetime", ">=", now)
        .where("start_datetime", "<=", end)
        .order_by("start_datetime")
        .get()
    )

    scheduled = "\n".join(
        f"- {e['title']} on {e['start_datetime'].strftime('%A %b %-d')}"
        + (f" at {e['start_datetime'].strftime('%-I:%M %p')}" if not e.get("is_all_day") else "")
        for e in [d.to_dict() for d in event_docs][:20]
    ) or "Nothing scheduled yet."

    prompt = f"""You are helping a family plan fun activities for the next 30 days.

Today: {now.strftime('%A, %B %-d, %Y')}
Location: {location}

Already scheduled:
{scheduled}

Suggest 5 specific, actionable family activities for the next 30 days. Pick evenings and weekends that don't conflict with what's already scheduled. Be concrete — include what to do, a good time for it, and why it would be fun.

Return ONLY a JSON array with this structure per item:
[
  {{
    "title": "Activity name",
    "description": "1-2 sentences about why this would be enjoyable",
    "start_datetime": "ISO 8601 UTC datetime",
    "end_datetime": "ISO 8601 UTC datetime"
  }}
]"""

    client = get_client()
    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    text = message.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]

    items = json.loads(text)

    # Replace existing pending suggestions
    for doc in (
        db.collection("suggestions")
        .where("family_id", "==", family_id)
        .where("status", "==", "pending")
        .get()
    ):
        doc.reference.delete()

    now = datetime.now(timezone.utc)
    for item in items[:5]:
        sid = str(uuid.uuid4())
        db.collection("suggestions").document(sid).set({
            "id": sid,
            "family_id": family_id,
            "type": "activity",
            "title": item["title"],
            "description": item["description"],
            "start_datetime": datetime.fromisoformat(item["start_datetime"].replace("Z", "+00:00")),
            "end_datetime": datetime.fromisoformat(item["end_datetime"].replace("Z", "+00:00")),
            "location": None,
            "price": None,
            "source_url": None,
            "source": "claude",
            "status": "pending",
            "created_at": now,
        })
