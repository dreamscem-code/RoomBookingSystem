from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo import DESCENDING
from pymongo.database import Database

from app.db import get_database
from app.schemas.log import NotificationLog
from app.schemas.user import User
from app.security import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get(
    "/my",
    response_model=List[NotificationLog],
    summary="List notifications for the logged-in user",
)
def get_my_notifications(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (e.g. sent, unread, read)"),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Database = Depends(get_database),
):
    """Retrieve notification log history for the authenticated user."""
    query = {"recipient_id": current_user.id}
    if status_filter:
        query["status"] = status_filter

    cursor = db["notification_logs"].find(query).sort("created_at", DESCENDING).limit(limit)
    return [NotificationLog(**doc) for doc in cursor]


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationLog,
    summary="Mark a notification as read",
)
def mark_notification_as_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Database = Depends(get_database),
):
    """Mark a notification log entry as read by the user."""
    notif_col = db["notification_logs"]
    doc = notif_col.find_one({"_id": notification_id, "recipient_id": current_user.id})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    notif_col.update_one(
        {"_id": notification_id},
        {"$set": {"status": "read", "read_at": datetime.now(timezone.utc)}},
    )
    updated_doc = notif_col.find_one({"_id": notification_id})
    return NotificationLog(**updated_doc)
