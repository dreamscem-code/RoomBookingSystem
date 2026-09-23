from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pydantic import Field, field_validator

from .common import Actor, LogTarget, MongoBaseModel, NotificationChannel


class ActionLog(MongoBaseModel):
    id: str = Field(..., alias="_id")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    actor: Actor
    action: str  # e.g., "CREATE_BOOKING", "OVERRIDE_BOOKING"
    target: LogTarget
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("timestamp", mode="after")
    @classmethod
    def ensure_utc(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is None:
            return None
        if v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v.astimezone(timezone.utc)


class NotificationLog(MongoBaseModel):
    id: str = Field(..., alias="_id")
    recipient_id: str
    channel: NotificationChannel
    title: str
    message: str
    status: str = "unread"  # "unread", "read", "sent", "failed"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    read_at: Optional[datetime] = None

    @field_validator("created_at", "read_at", mode="after")
    @classmethod
    def ensure_utc(cls, v: Optional[datetime]) -> Optional[datetime]:
        """Ensure naive datetimes from MongoDB are explicitly marked as UTC."""
        if v is None:
            return None
        if v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v.astimezone(timezone.utc)
