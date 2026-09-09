import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo import ASCENDING, DESCENDING
from pymongo.database import Database

from app.db import get_database
from app.schemas.common import IssueCategory, RoleName
from app.schemas.room import (
    Room,
    RoomCreate,
    RoomIssueReport,
    RoomIssueReportCreate,
    RoomIssueReportUpdate,
    RoomUpdate,
)
from app.schemas.user import User
from app.security import get_current_user, require_roles

router = APIRouter(prefix="/rooms", tags=["Rooms"])


# ============================================================================
# Room Issue Reports (Global endpoints must be defined before /{room_id})
# ============================================================================

@router.get(
    "/issues/all",
    response_model=List[RoomIssueReport],
    summary="List all room issue reports across the facility",
)
def list_all_issues(
    status_filter: Optional[str] = Query(None, alias="status", pattern="^(open|in_progress|resolved|dismissed)$"),
    category: Optional[IssueCategory] = None,
    search: Optional[str] = Query(None, description="Search keyword in issue description"),
    current_user: User = Depends(require_roles(RoleName.ADMIN, RoleName.SUPERVISOR, RoleName.FULL_TIME_STAFF)),
    db: Database = Depends(get_database),
):
    """Retrieve all issue reports with optional filtering by status, category, and search keyword."""
    query = {}
    if status_filter:
        query["status"] = status_filter
    if category:
        query["category"] = category.value
    if search:
        query["description"] = {"$regex": re.escape(search.strip()), "$options": "i"}

    cursor = db["room_issue_reports"].find(query).sort("created_at", DESCENDING)
    return [RoomIssueReport(**doc) for doc in cursor]


@router.patch(
    "/issues/{issue_id}",
    response_model=RoomIssueReport,
    summary="Update room issue report status or assign technician",
)
def update_issue_report(
    issue_id: str,
    payload: RoomIssueReportUpdate,
    current_user: User = Depends(require_roles(RoleName.ADMIN, RoleName.SUPERVISOR)),
    db: Database = Depends(get_database),
):
    """Update issue status (e.g. in_progress, resolved) or assign a staff member."""
    issues_col = db["room_issue_reports"]
    issue_doc = issues_col.find_one({"_id": issue_id})
    if not issue_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Issue report not found",
        )

    update_fields = {}
    if payload.status is not None:
        update_fields["status"] = payload.status
    if payload.assigned_to is not None:
        update_fields["assigned_to"] = payload.assigned_to

    if update_fields:
        issues_col.update_one({"_id": issue_id}, {"$set": update_fields})
        issue_doc = issues_col.find_one({"_id": issue_id})

    return RoomIssueReport(**issue_doc)


# ============================================================================
# Rooms CRUD Endpoints
# ============================================================================

@router.post(
    "",
    response_model=Room,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new room (Admin & Supervisor only)",
)
def create_room(
    payload: RoomCreate,
    current_user: User = Depends(require_roles(RoleName.ADMIN, RoleName.SUPERVISOR)),
    db: Database = Depends(get_database),
):
    """Create a new bookable room."""
    rooms_col = db["rooms"]

    # Check for duplicate room name (case-insensitive)
    existing = rooms_col.find_one({
        "name": {"$regex": f"^{re.escape(payload.name.strip())}$", "$options": "i"}
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A room named '{payload.name}' already exists",
        )

    room_id = str(uuid.uuid4())
    room = Room(
        _id=room_id,
        name=payload.name.strip(),
        amenities=payload.amenities,
        is_active=payload.is_active,
        created_at=datetime.now(timezone.utc),
    )

    rooms_col.insert_one(room.to_mongo())
    created_doc = rooms_col.find_one({"_id": room_id})
    return Room(**created_doc)


@router.get(
    "",
    response_model=List[Room],
    summary="List and filter rooms",
)
def list_rooms(
    amenity: Optional[str] = Query(None, description="Filter by required amenity (e.g. Projector)"),
    is_active: Optional[bool] = Query(True, description="Filter active rooms (pass empty to list all)"),
    current_user: User = Depends(get_current_user),
    db: Database = Depends(get_database),
):
    """Browse rooms with optional amenity and active status filters."""
    query = {}
    if is_active is not None:
        query["is_active"] = is_active
    if amenity:
        query["amenities"] = {"$regex": re.escape(amenity.strip()), "$options": "i"}

    cursor = db["rooms"].find(query).sort("name", ASCENDING)
    return [Room(**doc) for doc in cursor]


@router.get(
    "/{room_id}",
    response_model=Room,
    summary="Get room details by ID",
)
def get_room(
    room_id: str,
    current_user: User = Depends(get_current_user),
    db: Database = Depends(get_database),
):
    """Retrieve details of a single room."""
    room_doc = db["rooms"].find_one({"_id": room_id})
    if not room_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )
    return Room(**room_doc)


@router.patch(
    "/{room_id}",
    response_model=Room,
    summary="Update room details (Admin & Supervisor only)",
)
def update_room(
    room_id: str,
    payload: RoomUpdate,
    current_user: User = Depends(require_roles(RoleName.ADMIN, RoleName.SUPERVISOR)),
    db: Database = Depends(get_database),
):
    """Update room attributes (amenities, status)."""
    rooms_col = db["rooms"]
    room_doc = rooms_col.find_one({"_id": room_id})
    if not room_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )

    update_fields = {}
    if payload.name is not None:
        name_clean = payload.name.strip()
        # Check name collision with another room
        collision = rooms_col.find_one({
            "_id": {"$ne": room_id},
            "name": {"$regex": f"^{re.escape(name_clean)}$", "$options": "i"},
        })
        if collision:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Another room named '{name_clean}' already exists",
            )
        update_fields["name"] = name_clean

    if payload.amenities is not None:
        update_fields["amenities"] = payload.amenities
    if payload.is_active is not None:
        update_fields["is_active"] = payload.is_active

    if update_fields:
        rooms_col.update_one({"_id": room_id}, {"$set": update_fields})
        room_doc = rooms_col.find_one({"_id": room_id})

    return Room(**room_doc)


@router.delete(
    "/{room_id}",
    summary="Deactivate (soft-delete) a room (Admin only)",
)
def delete_room(
    room_id: str,
    current_user: User = Depends(require_roles(RoleName.ADMIN)),
    db: Database = Depends(get_database),
):
    """Soft-delete a room by setting is_active to false to preserve historical booking data."""
    rooms_col = db["rooms"]
    room_doc = rooms_col.find_one({"_id": room_id})
    if not room_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )

    rooms_col.update_one({"_id": room_id}, {"$set": {"is_active": False}})
    return {
        "message": f"Room '{room_doc['name']}' deactivated successfully",
        "room_id": room_id,
        "is_active": False,
    }


# ============================================================================
# Room-Specific Issue Reporting
# ============================================================================

@router.post(
    "/{room_id}/issues",
    response_model=RoomIssueReport,
    status_code=status.HTTP_201_CREATED,
    summary="Report an issue for a room (Any authenticated user)",
)
def report_room_issue(
    room_id: str,
    payload: RoomIssueReportCreate,
    current_user: User = Depends(get_current_user),
    db: Database = Depends(get_database),
):
    """Submit a report for an issue with a specific room (e.g. broken AV, cleanliness)."""
    room_doc = db["rooms"].find_one({"_id": room_id})
    if not room_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )

    issue_id = str(uuid.uuid4())
    issue = RoomIssueReport(
        _id=issue_id,
        room_id=room_id,
        reported_by=current_user.id,
        category=payload.category,
        description=payload.description.strip(),
        status="open",
        created_at=datetime.now(timezone.utc),
    )

    db["room_issue_reports"].insert_one(issue.to_mongo())
    created_doc = db["room_issue_reports"].find_one({"_id": issue_id})
    return RoomIssueReport(**created_doc)


@router.get(
    "/{room_id}/issues",
    response_model=List[RoomIssueReport],
    summary="List issue reports for a specific room",
)
def list_room_issues(
    room_id: str,
    current_user: User = Depends(get_current_user),
    db: Database = Depends(get_database),
):
    """Retrieve all issue reports logged against a specific room."""
    room_doc = db["rooms"].find_one({"_id": room_id})
    if not room_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )

    cursor = db["room_issue_reports"].find({"room_id": room_id}).sort("created_at", DESCENDING)
    return [RoomIssueReport(**doc) for doc in cursor]
