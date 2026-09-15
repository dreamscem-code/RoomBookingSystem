import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from .common import MongoBaseModel, RoleName, Team, UserType


class Profile(BaseModel):
    first_name: str
    last_name: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None


class UserRole(BaseModel):
    role_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role_name: RoleName
    assigned_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class User(MongoBaseModel):
    """User document representation without sensitive fields."""
    id: str = Field(..., alias="_id")
    email: EmailStr
    user_type: UserType
    team: Team
    is_active: bool = True
    profile: Profile
    roles: List[UserRole] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserInDB(User):
    """User model as stored in MongoDB, including the hashed password."""
    hashed_password: str


class UserCreate(BaseModel):
    """Payload for user registration."""
    email: EmailStr
    password: str = Field(..., min_length=6, description="Minimum 6 characters")
    user_type: UserType = UserType.FULL_TIME
    team: Team = Team.YOUTH
    profile: Profile
    roles: List[UserRole] = []

    @field_validator("roles", mode="before")
    @classmethod
    def normalize_roles(cls, v: Any) -> Any:
        if isinstance(v, list):
            normalized = []
            for item in v:
                if isinstance(item, str):
                    normalized.append({"role_name": item})
                elif isinstance(item, dict):
                    normalized.append(item)
                else:
                    normalized.append(item)
            return normalized
        return v


class UserLogin(BaseModel):
    """Payload for user login."""
    email: Optional[str] = None
    username: Optional[str] = None
    password: str

    @model_validator(mode="before")
    @classmethod
    def check_identifier(cls, data: Any) -> Any:
        if isinstance(data, dict):
            email = data.get("email") or data.get("username")
            if not email:
                raise ValueError("Either email or username is required")
            data["email"] = email
            data["username"] = email
        return data


class Token(BaseModel):
    """JWT response payload."""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Decoded JWT payload."""
    user_id: Optional[str] = None
    email: Optional[str] = None


class ProfileUpdate(BaseModel):
    """All fields are optional — only provided fields will be updated."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    team: Optional[Team] = None
