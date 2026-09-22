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


@router.post(
    "/read-all",
    summary="Mark all notifications as read for the logged-in user",
)
def mark_all_notifications_as_read(
    current_user: User = Depends(get_current_user),
    db: Database = Depends(get_database),
):
    """Mark all unread notifications as read for the authenticated user."""
    notif_col = db["notification_logs"]
    now = datetime.now(timezone.utc)
    result = notif_col.update_many(
        {"recipient_id": current_user.id, "status": {"$ne": "read"}},
        {"$set": {"status": "read", "read_at": now}},
    )
    return {"message": "All notifications marked as read", "modified_count": result.modified_count}


@router.delete(
    "/clear-all",
    summary="Clear/delete all notifications for the logged-in user",
)
def clear_all_notifications(
    current_user: User = Depends(get_current_user),
    db: Database = Depends(get_database),
):
    """Delete all notification records for the authenticated user."""
    notif_col = db["notification_logs"]
    result = notif_col.delete_many({"recipient_id": current_user.id})
    return {"message": "Notifications cleared successfully", "deleted_count": result.deleted_count}


@router.delete(
    "/{notification_id}",
    summary="Delete a single notification for the logged-in user",
)
def delete_single_notification(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Database = Depends(get_database),
):
    """Delete a single notification record for the authenticated user."""
    notif_col = db["notification_logs"]
    result = notif_col.delete_one({"_id": notification_id, "recipient_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return {"message": "Notification deleted successfully"}
