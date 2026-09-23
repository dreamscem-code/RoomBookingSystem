from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator

from .common import BookingStatus, MongoBaseModel, RequestStatus


class TimeSlot(BaseModel):
    start: datetime
    end: datetime

    @field_validator("start", "end", mode="after")
    @classmethod
    def ensure_utc(cls, v: datetime) -> datetime:
        """Ensure naive datetimes from MongoDB are explicitly marked as UTC."""
        if v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v.astimezone(timezone.utc)


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

    @field_validator("requested_at", "reviewed_at", mode="after")
    @classmethod
    def ensure_utc(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is None:
            return None
        if v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v.astimezone(timezone.utc)


class Booking(MongoBaseModel):
    id: str = Field(..., alias="_id")
    room_id: str
    room_name: str
    created_by: str
    creator_name: Optional[str] = None
    creator_email: Optional[str] = None
    title: str
    time_slot: TimeSlot
    status: BookingStatus = BookingStatus.CONFIRMED
    attendees: List[Attendee] = []
    cancellation_request: Optional[CancellationRequest] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("created_at", mode="after")
    @classmethod
    def ensure_utc(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is None:
            return None
        if v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v.astimezone(timezone.utc)


class BookingCreate(BaseModel):
    room_id: str
    title: str = Field(..., min_length=2, max_length=100, description="Meeting title or purpose")
    time_slot: TimeSlot
    attendees: List[Attendee] = Field(default_factory=list, description="List of attendees")

    @model_validator(mode="after")
    def validate_time_slot(self) -> "BookingCreate":
        if self.time_slot.start >= self.time_slot.end:
            raise ValueError("Start time must be strictly before end time")
        return self


class BookingUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=100)
    time_slot: Optional[TimeSlot] = None
    attendees: Optional[List[Attendee]] = None

    @model_validator(mode="after")
    def validate_time_slot(self) -> "BookingUpdate":
        if self.time_slot and self.time_slot.start >= self.time_slot.end:
            raise ValueError("Start time must be strictly before end time")
        return self


class CancellationRequestCreate(BaseModel):
    reason: str = Field(..., min_length=5, max_length=500, description="Reason for requesting cancellation")


class CancellationReview(BaseModel):
    action: RequestStatus = Field(..., description="Action to take: approved or rejected")
    admin_notes: Optional[str] = Field(None, max_length=500, description="Optional notes from the administrator")


class AvailabilityResponse(BaseModel):
    room_id: str
    is_available: bool
    conflicting_bookings: List[Booking] = []
