from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field

from .common import MongoBaseModel, RoleName, Team, UserType


class Profile(BaseModel):
    first_name: str
    last_name: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None


class UserRole(BaseModel):
    role_id: str
    role_name: RoleName
    assigned_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class User(MongoBaseModel):
    id: str = Field(..., alias="_id")
    email: EmailStr
    user_type: UserType
    team: Team
    is_active: bool = True
    profile: Profile
    roles: List[UserRole] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
