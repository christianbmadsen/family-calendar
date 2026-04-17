from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from typing import Optional, Literal
from firebase import db
from models.suggestion import Suggestion
from models.family import Family
from models.user import User
from dependencies import get_current_family
from services.notifications import notify_family, fmt_suggestion_accepted
from services.google_calendar import GoogleCalendarService
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/suggestions", tags=["suggestions"])


def _owner_service(family: Family) -> Optional[GoogleCalendarService]:
    owner_doc = db.collection("users").document(family.owner_id).get()
    if not owner_doc.exists:
        return None
    token = owner_doc.to_dict().get("google_refresh_token")
    return GoogleCalendarService(token) if token else None


def _bg_sync_accepted_event(event_data: dict, family: Family) -> None:
    svc = _owner_service(family)
    if not svc or not family.google_calendar_id:
        return
    try:
        from models.event import Event
        event = Event(**event_data)
        gid = svc.create_event(family.google_calendar_id, event)
        db.collection("events").document(event.id).update({"google_event_id": gid})
    except Exception as exc:
        print(f"[suggestions] Google Calendar sync failed: {exc}")


@router.get("", response_model=list[Suggestion])
def list_suggestions(
    type: Optional[Literal["opportunity", "travel_deal"]] = None,
    ctx: tuple[User, Family] = Depends(get_current_family),
):
    _, family = ctx
    query = (
        db.collection("suggestions")
        .where("family_id", "==", family.id)
        .where("status", "==", "pending")
    )
    if type:
        query = query.where("type", "==", type)

    docs = query.order_by("created_at").get()
    return [Suggestion(**d.to_dict()) for d in docs]


@router.put("/{suggestion_id}/accept", response_model=Suggestion)
def accept_suggestion(
    suggestion_id: str,
    background_tasks: BackgroundTasks,
    ctx: tuple[User, Family] = Depends(get_current_family),
):
    user, family = ctx
    doc = db.collection("suggestions").document(suggestion_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    suggestion = Suggestion(**doc.to_dict())
    if suggestion.family_id != family.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if suggestion.status != "pending":
        raise HTTPException(status_code=400, detail="Suggestion already actioned")

    # Mark accepted
    db.collection("suggestions").document(suggestion_id).update({"status": "accepted"})

    # Create calendar event from suggestion
    now = datetime.now(timezone.utc)
    event_id = str(uuid.uuid4())
    event_data = {
        "id": event_id,
        "family_id": family.id,
        "title": suggestion.title,
        "description": suggestion.description,
        "start_datetime": suggestion.start_datetime,
        "end_datetime": suggestion.end_datetime,
        "is_all_day": False,
        "location": suggestion.location,
        "references": suggestion.source_url,
        "google_event_id": None,
        "created_by": user.id,
        "created_at": now,
        "updated_at": now,
    }
    db.collection("events").document(event_id).set(event_data)

    background_tasks.add_task(_bg_sync_accepted_event, event_data, family)

    title, body = fmt_suggestion_accepted(user.name, suggestion.title)
    notify_family(family.id, title, body, data={"type": "suggestion_accepted", "event_id": event_id}, include_email=False)

    return Suggestion(**{**suggestion.model_dump(), "status": "accepted"})


@router.put("/{suggestion_id}/dismiss", response_model=Suggestion)
def dismiss_suggestion(
    suggestion_id: str,
    ctx: tuple[User, Family] = Depends(get_current_family),
):
    _, family = ctx
    doc = db.collection("suggestions").document(suggestion_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    suggestion = Suggestion(**doc.to_dict())
    if suggestion.family_id != family.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if suggestion.status != "pending":
        raise HTTPException(status_code=400, detail="Suggestion already actioned")

    db.collection("suggestions").document(suggestion_id).update({"status": "dismissed"})
    return Suggestion(**{**suggestion.model_dump(), "status": "dismissed"})
