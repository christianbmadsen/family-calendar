from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


class Suggestion(BaseModel):
    id: str
    family_id: str
    type: Literal["opportunity", "travel_deal"]
    title: str
    description: str
    start_datetime: datetime
    end_datetime: datetime
    location: Optional[str] = None
    price: Optional[str] = None
    source_url: Optional[str] = None
    source: Literal["google_events", "google_flights"]
    status: Literal["pending", "accepted", "dismissed"] = "pending"
    created_at: datetime
