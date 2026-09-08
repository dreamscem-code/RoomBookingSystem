from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field

from .common import BookingStatus, MongoBaseModel, RequestStatus


class TimeSlot(BaseModel):
    start: datetime
    end: datetime


class Attendee(BaseModel):
    user_id: str
    role: str = "attendee"  # "organizer", "co-host", "attendee"


class CancellationRequest(BaseModel):
    requested_by: str
    reason: str
    requested_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: RequestStatus = RequestStatus.PENDING
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    admin_notes: Optional[str] = None


class Booking(MongoBaseModel):
    id: str = Field(..., alias="_id")
    room_id: str
    room_name: str
    created_by: str
    title: str
    time_slot: TimeSlot
    status: BookingStatus = BookingStatus.CONFIRMED
    attendees: List[Attendee] = []
    cancellation_request: Optional[CancellationRequest] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
