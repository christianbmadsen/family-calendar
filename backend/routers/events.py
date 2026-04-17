import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from firebase import db
from models.event import Event, EventCreate, EventUpdate
from models.family import Family
from models.user import User
from dependencies import get_current_family
from services.google_calendar import GoogleCalendarService, SyncTokenExpired, _google_to_event_patch

router = APIRouter(prefix="/events", tags=["events"])


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _owner_service(family: Family) -> Optional[GoogleCalendarService]:
    """Return a CalendarService using the family owner's refresh token, or None."""
    if not family.google_calendar_id:
        return None
    owner_doc = db.collection("users").document(family.owner_id).get()
    if not owner_doc.exists:
        return None
    token = owner_doc.to_dict().get("google_refresh_token")
    return GoogleCalendarService(token) if token else None


def _bg_create(event: Event, family: Family) -> None:
    svc = _owner_service(family)
    if not svc:
        return
    try:
        gid = svc.create_event(family.google_calendar_id, event)
        db.collection("events").document(event.id).update({"google_event_id": gid})
    except Exception as exc:
        print(f"[calendar] create sync failed: {exc}")


def _bg_update(event: Event, family: Family) -> None:
    svc = _owner_service(family)
    if not svc or not event.google_event_id:
        return
    try:
        svc.update_event(family.google_calendar_id, event.google_event_id, event)
    except Exception as exc:
        print(f"[calendar] update sync failed: {exc}")


def _bg_delete(google_event_id: str, family: Family) -> None:
    svc = _owner_service(family)
    if not svc:
        return
    try:
        svc.delete_event(family.google_calendar_id, google_event_id)
    except Exception as exc:
        print(f"[calendar] delete sync failed: {exc}")


def _bg_sync(family: Family) -> None:
    svc = _owner_service(family)
    if not svc:
        return

    family_ref = db.collection("families").document(family.id)

    try:
        items, next_sync_token = svc.sync(family.google_calendar_id, family.google_sync_token)
    except SyncTokenExpired:
        # Full re-sync
        items, next_sync_token = svc.sync(family.google_calendar_id, sync_token=None)

    for item in items:
        google_event_id = item["id"]
        status = item.get("status")

        # Find matching Firestore event
        matches = (
            db.collection("events")
            .where("family_id", "==", family.id)
            .where("google_event_id", "==", google_event_id)
            .limit(1)
            .get()
        )

        if status == "cancelled":
            for m in matches:
                m.reference.delete()
            continue

        patch = _google_to_event_patch(item)

        if matches:
            matches[0].reference.update(patch)
        else:
            # New event created directly in Google Calendar
            now = datetime.now(timezone.utc)
            event_data = {
                "id": str(uuid.uuid4()),
                "family_id": family.id,
                "google_event_id": google_event_id,
                "created_by": family.owner_id,
                "created_at": now,
                "references": None,
                **patch,
            }
            db.collection("events").document(event_data["id"]).set(event_data)

    if next_sync_token:
        family_ref.update({"google_sync_token": next_sync_token})


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("", response_model=list[Event])
def list_events(
    from_date: Optional[datetime] = Query(None, alias="from"),
    to_date: Optional[datetime] = Query(None, alias="to"),
    ctx: tuple[User, Family] = Depends(get_current_family),
):
    _, family = ctx
    query = db.collection("events").where("family_id", "==", family.id)

    if from_date:
        query = query.where("start_datetime", ">=", from_date)
    if to_date:
        query = query.where("start_datetime", "<=", to_date)

    docs = query.order_by("start_datetime").get()
    return [Event(**d.to_dict()) for d in docs]


@router.post("", response_model=Event, status_code=201)
def create_event(
    body: EventCreate,
    background_tasks: BackgroundTasks,
    ctx: tuple[User, Family] = Depends(get_current_family),
):
    user, family = ctx
    now = datetime.now(timezone.utc)
    event_id = str(uuid.uuid4())

    event_data = {
        "id": event_id,
        "family_id": family.id,
        "title": body.title,
        "description": body.description,
        "start_datetime": body.start_datetime,
        "end_datetime": body.end_datetime,
        "is_all_day": body.start_datetime is None,
        "location": body.location,
        "references": body.references,
        "google_event_id": None,
        "created_by": user.id,
        "created_at": now,
        "updated_at": now,
    }

    db.collection("events").document(event_id).set(event_data)
    event = Event(**event_data)
    background_tasks.add_task(_bg_create, event, family)
    return event


@router.get("/{event_id}", response_model=Event)
def get_event(
    event_id: str,
    ctx: tuple[User, Family] = Depends(get_current_family),
):
    _, family = ctx
    doc = db.collection("events").document(event_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Event not found")

    event = Event(**doc.to_dict())
    if event.family_id != family.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return event


@router.put("/{event_id}", response_model=Event)
def update_event(
    event_id: str,
    body: EventUpdate,
    background_tasks: BackgroundTasks,
    ctx: tuple[User, Family] = Depends(get_current_family),
):
    _, family = ctx
    doc = db.collection("events").document(event_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Event not found")

    event = Event(**doc.to_dict())
    if event.family_id != family.id:
        raise HTTPException(status_code=403, detail="Access denied")

    updates = body.model_dump(exclude_none=True)
    updates["updated_at"] = datetime.now(timezone.utc)

    if "start_datetime" in updates:
        updates["is_all_day"] = updates["start_datetime"] is None

    db.collection("events").document(event_id).update(updates)
    updated = Event(**{**event.model_dump(), **updates})
    background_tasks.add_task(_bg_update, updated, family)
    return updated


@router.delete("/{event_id}", status_code=204)
def delete_event(
    event_id: str,
    background_tasks: BackgroundTasks,
    ctx: tuple[User, Family] = Depends(get_current_family),
):
    _, family = ctx
    doc = db.collection("events").document(event_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Event not found")

    event = Event(**doc.to_dict())
    if event.family_id != family.id:
        raise HTTPException(status_code=403, detail="Access denied")

    db.collection("events").document(event_id).delete()

    if event.google_event_id:
        background_tasks.add_task(_bg_delete, event.google_event_id, family)


@router.post("/sync", status_code=204)
def sync_events(
    background_tasks: BackgroundTasks,
    ctx: tuple[User, Family] = Depends(get_current_family),
):
    _, family = ctx
    background_tasks.add_task(_bg_sync, family)
