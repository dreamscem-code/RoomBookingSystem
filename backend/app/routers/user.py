import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from pymongo import ASCENDING
from pymongo.database import Database

from app.db import get_database
from app.schemas.common import RoleName
from app.schemas.user import User, UserRole
from app.security import get_current_user, require_roles

router = APIRouter(prefix="/users", tags=["Users"])


class UpdateUserRolesPayload(BaseModel):
    roles: List[str] = Field(..., description="List of role names (e.g. ['admin', 'supervisor'])")
    user_type: Optional[str] = Field(None, description="Employment type: full-time, part-time, contractor")
    team: Optional[str] = Field(None, description="Department: youth, family, admin, management")


def _find_user(users_col, user_id: str):
    doc = users_col.find_one({"_id": user_id})
    if not doc:
        try:
            from bson import ObjectId
            if ObjectId.is_valid(user_id):
                doc = users_col.find_one({"_id": ObjectId(user_id)})
        except Exception:
            pass
    return doc


@router.get(
    "",
    response_model=List[User],
    summary="List all users with their roles and profile information",
)
def list_users(
    role_filter: Optional[str] = Query(None, description="Filter by role name"),
    current_user: User = Depends(get_current_user),
    db: Database = Depends(get_database),
):
    """Retrieve all users in the system."""
    query = {}
    if role_filter:
        query["roles.role_name"] = role_filter.lower()

    cursor = db["users"].find(query).sort("created_at", ASCENDING)
    return [User(**doc) for doc in cursor]


@router.patch(
    "/{user_id}/roles",
    response_model=User,
    summary="Update roles and account type assigned to a user",
)
def update_user_roles(
    user_id: str,
    payload: UpdateUserRolesPayload,
    current_user: User = Depends(require_roles(RoleName.ADMIN)),
    db: Database = Depends(get_database),
):
    """Assign or update roles, user_type, and team for a user."""
    users_col = db["users"]
    user_doc = _find_user(users_col, user_id)
    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Validate each role name against the RoleName enum
    valid_roles_map = {r.value.lower(): r for r in RoleName}
    new_user_roles = []

    for r_str in payload.roles:
        r_clean = r_str.strip().lower()
        if r_clean not in valid_roles_map:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role '{r_str}'. Allowed roles: {[r.value for r in RoleName]}",
            )
        new_user_roles.append(
            UserRole(
                role_id=str(uuid.uuid4()),
                role_name=valid_roles_map[r_clean],
                assigned_at=datetime.now(timezone.utc),
            ).model_dump()
        )

    actual_id = user_doc["_id"]
    update_data = {"roles": new_user_roles}
    if payload.user_type:
        update_data["user_type"] = payload.user_type.lower()
    if payload.team:
        update_data["team"] = payload.team.lower()

    users_col.update_one(
        {"_id": actual_id},
        {"$set": update_data}
    )

    updated_doc = users_col.find_one({"_id": actual_id})
    return User(**updated_doc)


@router.delete(
    "/{user_id}",
    summary="Delete a user account",
)
def delete_user(
    user_id: str,
    current_user: User = Depends(require_roles(RoleName.ADMIN)),
    db: Database = Depends(get_database),
):
    """Delete a user account with self-deletion prevention."""
    users_col = db["users"]
    user_doc = _find_user(users_col, user_id)
    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    actual_id = str(user_doc["_id"])

    # Prevent admin from accidentally deleting their own account
    if actual_id == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account while logged in.",
        )

    users_col.delete_one({"_id": user_doc["_id"]})

    return {
        "message": f"User {user_doc.get('email')} deleted successfully.",
        "user_id": actual_id,
    }
