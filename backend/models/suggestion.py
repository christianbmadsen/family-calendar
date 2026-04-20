from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


class Suggestion(BaseModel):
    id: str
    family_id: str
    type: Literal["opportunity", "travel_deal", "activity"]
    title: str
    description: str
    start_datetime: datetime
    end_datetime: datetime
    location: Optional[str] = None
    price: Optional[str] = None
    source_url: Optional[str] = None
    source: Literal["google_events", "google_flights", "claude"]
    status: Literal["pending", "accepted", "dismissed"] = "pending"
    created_at: datetime
