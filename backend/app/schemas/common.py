from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict


# --- Enums ---

class UserType(str, Enum):
    FULL_TIME = "full-time"
    PART_TIME = "part-time"
    CONTRACTOR = "contractor"


class Team(str, Enum):
    YOUTH = "youth"
    FAMILY = "family"
    ADMIN = "admin"
    MANAGEMENT = "management"


class RoleName(str, Enum):
    ADMIN = "admin"
    SUPERVISOR = "supervisor"
    FULL_TIME_STAFF = "full-time staff"
    PART_TIME_STAFF = "part-time staff"
    INTERN = "intern"
    VOLUNTEER = "volunteer"
    GUEST = "guest"


class BookingStatus(str, Enum):
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    CANCELLATION_PENDING = "cancellation_pending"
    COMPLETED = "completed"


class RequestStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class NotificationChannel(str, Enum):
    EMAIL = "email"
    SMS = "sms"
    IN_APP = "in-app"


class IssueCategory(str, Enum):
    CLEANLINESS = "cleanliness"
    AV_EQUIPMENT = "av_equipment"
    FURNITURE = "furniture"
    TEMPERATURE = "temperature"
    OTHER = "other"


# --- Shared Base Model & Sub-Documents ---

class MongoBaseModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    def to_mongo(self) -> Dict[str, Any]:
        """Convert model to dict suitable for PyMongo operations."""
        return self.model_dump(by_alias=True)


class Actor(BaseModel):
    user_id: Optional[str] = None
    role: Optional[str] = None
    ip_address: Optional[str] = None


class LogTarget(BaseModel):
    collection: str
    document_id: str
