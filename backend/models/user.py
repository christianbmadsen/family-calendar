from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class User(BaseModel):
    id: str
    email: str
    name: str
    photo_url: Optional[str] = None
    family_id: Optional[str] = None
    push_tokens: list[str] = []
    notify_push: bool = True
    notify_email: bool = True
    google_calendar_id: Optional[str] = None
    google_refresh_token: Optional[str] = None
    password_hash: Optional[str] = None
    created_at: datetime


class UserUpdate(BaseModel):
    notify_push: Optional[bool] = None
    notify_email: Optional[bool] = None
