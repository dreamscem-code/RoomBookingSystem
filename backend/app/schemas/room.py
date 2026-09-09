from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field

from .common import IssueCategory, MongoBaseModel


class RoomCreate(BaseModel):
    name: str = Field(..., min_length=2, description="Unique room name")
    amenities: List[str] = Field(default=[], description="List of room amenities (e.g., Projector, Whiteboard)")
    is_active: bool = True


class RoomUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2)
    amenities: Optional[List[str]] = None
    is_active: Optional[bool] = None


class Room(MongoBaseModel):
    id: str = Field(..., alias="_id")
    name: str
    amenities: List[str] = []
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RoomIssueReportCreate(BaseModel):
    category: IssueCategory
    description: str = Field(..., min_length=5, description="Details of the issue")


class RoomIssueReportUpdate(BaseModel):
    status: Optional[str] = Field(None, pattern="^(open|in_progress|resolved|dismissed)$")
    assigned_to: Optional[str] = None


class RoomIssueReport(MongoBaseModel):
    id: str = Field(..., alias="_id")
    room_id: str
    reported_by: str
    category: IssueCategory
    description: str
    status: str = "open"  # "open", "in_progress", "resolved", "dismissed"
    assigned_to: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
