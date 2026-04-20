import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from firebase import db
from models.suggestion import Suggestion
from models.user import User
from models.family import Family
from dependencies import get_current_family
from config import settings

router = APIRouter(prefix="/suggestions", tags=["suggestions"])


@router.get("", response_model=List[Suggestion])
def list_suggestions(ctx: tuple = Depends(get_current_family)):
    _, family = ctx
    docs = (
        db.collection("suggestions")
        .where("family_id", "==", family.id)
        .where("status", "==", "pending")
        .get()
    )
    return [Suggestion(**d.to_dict()) for d in docs]


@router.post("/generate", status_code=202)
def generate_suggestions(
    background_tasks: BackgroundTasks,
    ctx: tuple = Depends(get_current_family),
):
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=503, detail="AI suggestions not configured — add ANTHROPIC_API_KEY to .env")
    _, family = ctx
    from services.agents.suggestions import run_suggestions_agent
    background_tasks.add_task(run_suggestions_agent, family.id)
    return {"status": "generating"}


@router.post("/{suggestion_id}/accept", response_model=Suggestion)
def accept_suggestion(
    suggestion_id: str,
    ctx: tuple = Depends(get_current_family),
):
    user, family = ctx
    doc = db.collection("suggestions").document(suggestion_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    s = doc.to_dict()
    if s["family_id"] != family.id:
        raise HTTPException(status_code=403)

    event_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    db.collection("events").document(event_id).set({
        "id": event_id,
        "family_id": family.id,
        "title": s["title"],
        "description": s.get("description"),
        "start_datetime": s["start_datetime"],
        "end_datetime": s["end_datetime"],
        "is_all_day": False,
        "location": s.get("location"),
        "references": None,
        "google_event_id": None,
        "created_by": user.id,
        "created_at": now,
        "updated_at": now,
    })
    db.collection("suggestions").document(suggestion_id).update({"status": "accepted"})
    return Suggestion(**{**s, "status": "accepted"})


@router.post("/{suggestion_id}/dismiss", status_code=204)
def dismiss_suggestion(
    suggestion_id: str,
    ctx: tuple = Depends(get_current_family),
):
    _, family = ctx
    doc = db.collection("suggestions").document(suggestion_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    s = doc.to_dict()
    if s["family_id"] != family.id:
        raise HTTPException(status_code=403)
    db.collection("suggestions").document(suggestion_id).update({"status": "dismissed"})
