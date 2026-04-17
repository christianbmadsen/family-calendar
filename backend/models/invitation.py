from pydantic import BaseModel
from typing import Literal
from datetime import datetime


class Invitation(BaseModel):
    id: str
    family_id: str
    invited_email: str
    invited_by: str
    status: Literal["pending", "accepted", "declined"] = "pending"
    created_at: datetime
