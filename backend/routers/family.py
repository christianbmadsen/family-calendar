import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from firebase import db
from models.family import Family, FamilyCreate, FamilyUpdate, InviteRequest
from models.invitation import Invitation
from models.user import User
from dependencies import get_current_user, get_current_family
from services.google_calendar import GoogleCalendarService

router = APIRouter(prefix="/family", tags=["family"])


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_calendar_service(family: Family) -> Optional[GoogleCalendarService]:
    owner_doc = db.collection("users").document(family.owner_id).get()
    if not owner_doc.exists:
        return None
    token = owner_doc.to_dict().get("google_refresh_token")
    return GoogleCalendarService(token) if token else None


def _bg_create_calendar(family_id: str, family_name: str, refresh_token: str) -> None:
    try:
        svc = GoogleCalendarService(refresh_token)
        cal_id = svc.create_family_calendar(family_name)
        db.collection("families").document(family_id).update(
            {"google_calendar_id": cal_id}
        )
    except Exception as exc:
        print(f"[calendar] create family calendar failed: {exc}")


def _bg_share_calendar(family: Family, email: str) -> None:
    if not family.google_calendar_id:
        return
    svc = _get_calendar_service(family)
    if not svc:
        return
    try:
        svc.share_calendar(family.google_calendar_id, email)
    except Exception as exc:
        print(f"[calendar] share calendar failed: {exc}")


def _bg_remove_calendar_member(family: Family, email: str) -> None:
    if not family.google_calendar_id:
        return
    svc = _get_calendar_service(family)
    if not svc:
        return
    try:
        svc.remove_calendar_member(family.google_calendar_id, email)
    except Exception as exc:
        print(f"[calendar] remove calendar member failed: {exc}")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("", response_model=Family, status_code=201)
def create_family(
    body: FamilyCreate,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
):
    if user.family_id:
        raise HTTPException(status_code=400, detail="User already belongs to a family")

    family_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    family_data = {
        "id": family_id,
        "name": body.name,
        "owner_id": user.id,
        "member_ids": [user.id],
        "home_location": body.home_location,
        "home_airport": body.home_airport,
        "google_calendar_id": None,
        "google_sync_token": None,
        "created_at": now,
    }

    db.collection("families").document(family_id).set(family_data)
    db.collection("users").document(user.id).update({"family_id": family_id})

    if user.google_refresh_token:
        background_tasks.add_task(
            _bg_create_calendar, family_id, body.name, user.google_refresh_token
        )

    return Family(**family_data)


@router.get("", response_model=Family)
def get_family(ctx: tuple[User, Family] = Depends(get_current_family)):
    _, family = ctx
    return family


@router.put("", response_model=Family)
def update_family(
    body: FamilyUpdate,
    ctx: tuple[User, Family] = Depends(get_current_family),
):
    user, family = ctx
    if family.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only the owner can update family settings")

    updates = body.model_dump(exclude_none=True)
    if not updates:
        return family

    db.collection("families").document(family.id).update(updates)
    return Family(**{**family.model_dump(), **updates})


@router.post("/invite", response_model=Invitation, status_code=201)
def invite_member(
    body: InviteRequest,
    ctx: tuple[User, Family] = Depends(get_current_family),
):
    user, family = ctx
    if family.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only the owner can invite members")

    # Check if already a member
    existing_user = (
        db.collection("users").where("email", "==", body.email).limit(1).get()
    )
    if existing_user:
        member_id = existing_user[0].to_dict()["id"]
        if member_id in family.member_ids:
            raise HTTPException(status_code=400, detail="User is already a family member")

    # Check for existing pending invitation
    existing_invite = (
        db.collection("invitations")
        .where("family_id", "==", family.id)
        .where("invited_email", "==", body.email)
        .where("status", "==", "pending")
        .limit(1)
        .get()
    )
    if existing_invite:
        raise HTTPException(status_code=400, detail="Invitation already sent to this email")

    invitation_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    invitation_data = {
        "id": invitation_id,
        "family_id": family.id,
        "invited_email": body.email,
        "invited_by": user.id,
        "status": "pending",
        "created_at": now,
    }

    db.collection("invitations").document(invitation_id).set(invitation_data)
    return Invitation(**invitation_data)


@router.post("/join/{invitation_id}", response_model=Family)
def join_family(
    invitation_id: str,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
):
    if user.family_id:
        raise HTTPException(status_code=400, detail="User already belongs to a family")

    invite_doc = db.collection("invitations").document(invitation_id).get()
    if not invite_doc.exists:
        raise HTTPException(status_code=404, detail="Invitation not found")

    invitation = Invitation(**invite_doc.to_dict())

    if invitation.status != "pending":
        raise HTTPException(status_code=400, detail="Invitation is no longer valid")

    if invitation.invited_email.lower() != user.email.lower():
        raise HTTPException(status_code=403, detail="Invitation is for a different email address")

    family_doc = db.collection("families").document(invitation.family_id).get()
    if not family_doc.exists:
        raise HTTPException(status_code=404, detail="Family not found")

    family = Family(**family_doc.to_dict())

    # Prevent duplicate join (concurrent requests)
    if user.id in family.member_ids:
        raise HTTPException(status_code=400, detail="Already a member of this family")

    # Atomic update: add member + accept invitation
    batch = db.batch()
    batch.update(
        db.collection("families").document(family.id),
        {"member_ids": family.member_ids + [user.id]},
    )
    batch.update(
        db.collection("users").document(user.id),
        {"family_id": family.id},
    )
    batch.update(
        db.collection("invitations").document(invitation_id),
        {"status": "accepted"},
    )
    batch.commit()

    background_tasks.add_task(_bg_share_calendar, family, user.email)

    updated_family = Family(**{
        **family.model_dump(),
        "member_ids": family.member_ids + [user.id],
    })
    return updated_family


@router.delete("/members/{member_id}", status_code=204)
def remove_member(
    member_id: str,
    background_tasks: BackgroundTasks,
    ctx: tuple[User, Family] = Depends(get_current_family),
):
    user, family = ctx

    if family.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only the owner can remove members")

    if member_id == family.owner_id:
        raise HTTPException(status_code=400, detail="Owner cannot be removed from the family")

    if member_id not in family.member_ids:
        raise HTTPException(status_code=404, detail="Member not found")

    member_doc = db.collection("users").document(member_id).get()
    if not member_doc.exists:
        raise HTTPException(status_code=404, detail="User not found")

    member_email = member_doc.to_dict()["email"]
    updated_members = [m for m in family.member_ids if m != member_id]

    batch = db.batch()
    batch.update(
        db.collection("families").document(family.id),
        {"member_ids": updated_members},
    )
    batch.update(
        db.collection("users").document(member_id),
        {"family_id": None},
    )
    batch.commit()

    background_tasks.add_task(_bg_remove_calendar_member, family, member_email)
