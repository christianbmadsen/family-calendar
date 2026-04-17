from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class Family(BaseModel):
    id: str
    name: str
    owner_id: str
    member_ids: list[str] = []
    home_location: str
    home_airport: str
    google_calendar_id: Optional[str] = None
    google_sync_token: Optional[str] = None
    created_at: datetime


class FamilyCreate(BaseModel):
    name: str
    home_location: str
    home_airport: str


class FamilyUpdate(BaseModel):
    name: Optional[str] = None
    home_location: Optional[str] = None
    home_airport: Optional[str] = None


class InviteRequest(BaseModel):
    email: str
