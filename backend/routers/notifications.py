from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from firebase import db
from models.user import User, UserUpdate
from dependencies import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


class PushTokenRequest(BaseModel):
    token: str


class NotificationPreferences(BaseModel):
    notify_push: bool
    notify_email: bool


@router.get("/preferences", response_model=NotificationPreferences)
def get_preferences(user: User = Depends(get_current_user)):
    return NotificationPreferences(
        notify_push=user.notify_push,
        notify_email=user.notify_email,
    )


@router.put("/preferences", response_model=NotificationPreferences)
def update_preferences(
    body: UserUpdate,
    user: User = Depends(get_current_user),
):
    updates = body.model_dump(exclude_none=True)
    if updates:
        db.collection("users").document(user.id).update(updates)

    updated = {**user.model_dump(), **updates}
    return NotificationPreferences(
        notify_push=updated["notify_push"],
        notify_email=updated["notify_email"],
    )


@router.post("/push-token", status_code=204)
def register_push_token(
    body: PushTokenRequest,
    user: User = Depends(get_current_user),
):
    if not body.token.startswith("ExponentPushToken["):
        raise HTTPException(status_code=400, detail="Invalid Expo push token format")

    if body.token in user.push_tokens:
        return

    db.collection("users").document(user.id).update(
        {"push_tokens": user.push_tokens + [body.token]}
    )
