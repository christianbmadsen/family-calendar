from pydantic import BaseModel, model_validator
from typing import Optional
from datetime import datetime


class Event(BaseModel):
    id: str
    family_id: str
    title: str
    description: Optional[str] = None
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    is_all_day: bool = False
    location: Optional[str] = None
    references: Optional[str] = None
    google_event_id: Optional[str] = None
    created_by: str
    created_at: datetime
    updated_at: datetime


class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    location: Optional[str] = None
    references: Optional[str] = None

    @model_validator(mode="after")
    def validate_times(self) -> "EventCreate":
        if self.start_datetime and self.end_datetime:
            if self.end_datetime <= self.start_datetime:
                raise ValueError("end_datetime must be after start_datetime")
        if self.end_datetime and not self.start_datetime:
            raise ValueError("end_datetime requires start_datetime")
        return self


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    location: Optional[str] = None
    references: Optional[str] = None

    @model_validator(mode="after")
    def validate_times(self) -> "EventUpdate":
        if self.start_datetime and self.end_datetime:
            if self.end_datetime <= self.start_datetime:
                raise ValueError("end_datetime must be after start_datetime")
        return self
