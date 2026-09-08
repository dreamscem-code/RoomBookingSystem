from datetime import datetime, timezone
from typing import List, Optional
from pydantic import Field

from .common import IssueCategory, MongoBaseModel


class Room(MongoBaseModel):
    id: str = Field(..., alias="_id")
    name: str
    capacity: int
    location: str
    amenities: List[str] = []
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RoomIssueReport(MongoBaseModel):
    id: str = Field(..., alias="_id")
    room_id: str
    reported_by: str
    category: IssueCategory
    description: str
    status: str = "open"  # "open", "in_progress", "resolved", "dismissed"
    assigned_to: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
