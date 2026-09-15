import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pymongo import ASCENDING, DESCENDING
from pymongo.database import Database

from app.services.notification import (
    send_booking_cancelled_notification,
    send_booking_created_notification,
)

from app.db import get_database
from app.schemas.booking import (
    AvailabilityResponse,
    Booking,
    BookingCreate,
    BookingUpdate,
    CancellationRequest,
    CancellationRequestCreate,
    CancellationReview,
    TimeSlot,
)
from app.schemas.common import BookingStatus, RequestStatus, RoleName
from app.schemas.user import User
from app.security import get_current_user, require_roles

router = APIRouter(prefix="/bookings", tags=["Bookings"])


# ============================================================================
# Helper Functions
# ============================================================================

def _find_conflicts(
    db: Database,
    room_id: str,
    start_time: datetime,
    end_time: datetime,
    exclude_booking_id: Optional[str] = None,
) -> List[dict]:
    """Return any active bookings that overlap with the requested [start_time, end_time]."""
    conflict_query = {
        "room_id": room_id,
        "status": {
            "$in": [
                BookingStatus.CONFIRMED.value,
                BookingStatus.CANCELLATION_PENDING.value,
            ]
        },
        "time_slot.start": {"$lt": end_time},
        "time_slot.end": {"$gt": start_time},
    }
    if exclude_booking_id:
        conflict_query["_id"] = {"$ne": exclude_booking_id}

    return list(db["bookings"].find(conflict_query))


def _get_user_primary_role(user: User) -> str:
    """Return primary role string for a user."""
    if user.roles:
        return user.roles[0].role_name.value
    return "user"


def _is_admin_or_supervisor(user: User) -> bool:
    """Check if user has admin or supervisor role."""
    role_names = [r.role_name for r in user.roles]
    return any(r in [RoleName.ADMIN, RoleName.SUPERVISOR] for r in role_names)


def _log_action(
    db: Database,
    actor_id: str,
    actor_role: str,
    action: str,
    document_id: str,
    metadata: Optional[dict] = None,
) -> None:
    """Helper to record audit events in action_logs collection."""
    try:
        db["action_logs"].insert_one(
            {
                "_id": str(uuid.uuid4()),
                "timestamp": datetime.now(timezone.utc),
                "actor": {"user_id": actor_id, "role": actor_role},
                "action": action,
                "target": {"collection": "bookings", "document_id": document_id},
                "metadata": metadata or {},
            }
        )
    except Exception:
        # Avoid failing the main operation if audit logging encounters an issue
        pass


# ============================================================================
# Availability & Pending Reviews (Declared before /{booking_id} path params)
# ============================================================================

@router.get(
    "/check-availability",
    response_model=AvailabilityResponse,
    summary="Check if a room is available during a specified time window",
)
def check_room_availability(
    room_id: str = Query(..., description="ID of the room to check"),
    start_time: datetime = Query(..., description="Start of desired slot (ISO format)"),
    end_time: datetime = Query(..., description="End of desired slot (ISO format)"),
    db: Database = Depends(get_database),
):
    """Check room availability and return any overlapping conflicting bookings."""
    if start_time >= end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_time must be strictly earlier than end_time",
        )

    room = db["rooms"].find_one({"_id": room_id})
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )

    conflicts = _find_conflicts(db, room_id, start_time, end_time)
    return AvailabilityResponse(
        room_id=room_id,
        is_available=len(conflicts) == 0 and room.get("is_active", True),
        conflicting_bookings=[Booking(**doc) for doc in conflicts],
    )


@router.get(
    "/cancellations/pending",
    response_model=List[Booking],
    summary="List all pending cancellation requests (Admin & Supervisor only)",
)
def list_pending_cancellations(
    current_user: User = Depends(require_roles(RoleName.ADMIN, RoleName.SUPERVISOR)),
    db: Database = Depends(get_database),
):
    """Retrieve all bookings that have a pending cancellation request awaiting review."""
    cursor = db["bookings"].find(
        {"status": BookingStatus.CANCELLATION_PENDING.value}
    ).sort("cancellation_request.requested_at", ASCENDING)

    return [Booking(**doc) for doc in cursor]


# ============================================================================
# Bookings CRUD Endpoints
# ============================================================================

@router.post(
    "",
    response_model=Booking,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new room booking (Any authenticated user)",
)
def create_booking(
    payload: BookingCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Database = Depends(get_database),
):
    """Create a new room booking with schedule conflict prevention."""
    # 1. Verify target room exists and is active
    room_doc = db["rooms"].find_one({"_id": payload.room_id})
    if not room_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )
    if not room_doc.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot book a deactivated room",
        )

    # 2. Check for scheduling conflicts
    conflicts = _find_conflicts(
        db=db,
        room_id=payload.room_id,
        start_time=payload.time_slot.start,
        end_time=payload.time_slot.end,
    )
    if conflicts:
        conflict_sample = conflicts[0]
        c_slot = conflict_sample.get("time_slot", {})
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Schedule conflict: Room '{room_doc['name']}' is already booked from "
                f"{c_slot.get('start')} to {c_slot.get('end')} ('{conflict_sample.get('title')}')"
            ),
        )

    # 3. Insert new booking document
    booking_id = str(uuid.uuid4())
    booking = Booking(
        _id=booking_id,
        room_id=payload.room_id,
        room_name=room_doc["name"],
        created_by=current_user.id,
        title=payload.title.strip(),
        time_slot=payload.time_slot,
        status=BookingStatus.CONFIRMED,
        attendees=payload.attendees,
        cancellation_request=None,
        created_at=datetime.now(timezone.utc),
    )

    db["bookings"].insert_one(booking.to_mongo())

    _log_action(
        db=db,
        actor_id=current_user.id,
        actor_role=_get_user_primary_role(current_user),
        action="CREATE_BOOKING",
        document_id=booking_id,
        metadata={"room_id": payload.room_id, "title": payload.title},
    )

    # Dispatch email notifications to organizer, attendees, and organization in background
    background_tasks.add_task(
        send_booking_created_notification,
        db=db,
        booking=booking,
        organizer=current_user,
        notify_team=True,
    )

    return booking


@router.get(
    "",
    response_model=List[Booking],
    summary="List bookings with optional filters (room, dates, user)",
)
def list_bookings(
    room_id: Optional[str] = Query(None, description="Filter by room ID"),
    status_filter: Optional[BookingStatus] = Query(None, alias="status", description="Filter by status"),
    start_date: Optional[datetime] = Query(None, description="Filter bookings starting at or after this time"),
    end_date: Optional[datetime] = Query(None, description="Filter bookings ending at or before this time"),
    my_bookings: bool = Query(False, description="Filter only bookings created by the current user"), #to show the booking of current user if true, and false shows the booking of all users
    current_user: User = Depends(get_current_user),
    db: Database = Depends(get_database),
):
    """List bookings matching optional search and filter criteria."""
    query = {}
    if room_id:
        query["room_id"] = room_id
    if status_filter:
        query["status"] = status_filter.value
    if my_bookings:
        query["created_by"] = current_user.id

    if start_date or end_date:
        time_filter = {}
        if start_date:
            time_filter["$gte"] = start_date
        if end_date:
            time_filter["$lte"] = end_date
        query["time_slot.start"] = time_filter

    cursor = db["bookings"].find(query).sort("time_slot.start", ASCENDING)
    return [Booking(**doc) for doc in cursor]


@router.get(
    "/{booking_id}",
    response_model=Booking,
    summary="Get details of a specific booking",
)
def get_booking(
    booking_id: str,
    current_user: User = Depends(get_current_user),
    db: Database = Depends(get_database),
):
    """Retrieve details of a single booking by ID."""
    doc = db["bookings"].find_one({"_id": booking_id})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )
    return Booking(**doc)


@router.patch(
    "/{booking_id}",
    response_model=Booking,
    summary="Update a booking title, time slot, or attendees",
)
def update_booking(
    booking_id: str,
    payload: BookingUpdate,
    current_user: User = Depends(get_current_user),
    db: Database = Depends(get_database),
):
    """Update booking details. Time slot updates will automatically check for conflicts."""
    booking_doc = db["bookings"].find_one({"_id": booking_id})
    if not booking_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )

    # Permissions: Creator or Admin/Supervisor can update
    is_admin_or_super = _is_admin_or_supervisor(current_user)
    if booking_doc["created_by"] != current_user.id and not is_admin_or_super:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this booking",
        )

    if booking_doc["status"] == BookingStatus.CANCELLED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot edit a cancelled booking",
        )

    update_fields = {}

    if payload.title is not None:
        update_fields["title"] = payload.title.strip()

    if payload.attendees is not None:
        update_fields["attendees"] = [att.model_dump() for att in payload.attendees]

    if payload.time_slot is not None:
        # Check conflict against other active bookings
        conflicts = _find_conflicts(
            db=db,
            room_id=booking_doc["room_id"],
            start_time=payload.time_slot.start,
            end_time=payload.time_slot.end,
            exclude_booking_id=booking_id,
        )
        if conflicts:
            conflict_sample = conflicts[0]
            c_slot = conflict_sample.get("time_slot", {})
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Schedule conflict: Room is already booked from "
                    f"{c_slot.get('start')} to {c_slot.get('end')}"
                ),
            )
        update_fields["time_slot"] = payload.time_slot.model_dump()

    if update_fields:
        db["bookings"].update_one({"_id": booking_id}, {"$set": update_fields})
        booking_doc = db["bookings"].find_one({"_id": booking_id})

        _log_action(
            db=db,
            actor_id=current_user.id,
            actor_role=_get_user_primary_role(current_user),
            action="UPDATE_BOOKING",
            document_id=booking_id,
            metadata=update_fields,
        )

    return Booking(**booking_doc)


@router.delete(
    "/{booking_id}",
    response_model=Booking,
    summary="Cancel a booking immediately (Admin & Supervisor only)",
)
def cancel_booking_direct(
    booking_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_roles(RoleName.ADMIN, RoleName.SUPERVISOR)),
    db: Database = Depends(get_database),
):
    """Directly cancel a booking. Strictly restricted to Admins and Supervisors.
    Non-admin creators must submit a cancellation request via POST /{booking_id}/cancel-request."""
    booking_doc = db["bookings"].find_one({"_id": booking_id})
    if not booking_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )

    if booking_doc["status"] == BookingStatus.CANCELLED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Booking is already cancelled",
        )

    db["bookings"].update_one(
        {"_id": booking_id},
        {"$set": {"status": BookingStatus.CANCELLED.value}},
    )
    booking_doc = db["bookings"].find_one({"_id": booking_id})

    _log_action(
        db=db,
        actor_id=current_user.id,
        actor_role=_get_user_primary_role(current_user),
        action="CANCEL_BOOKING",
        document_id=booking_id,
    )

    background_tasks.add_task(
        send_booking_cancelled_notification,
        db=db,
        booking=Booking(**booking_doc),
        cancelled_by=current_user,
    )

    return Booking(**booking_doc)


# ============================================================================
# Cancellation Request & Review Flow
# ============================================================================

@router.post(
    "/{booking_id}/cancel-request",
    response_model=Booking,
    summary="Submit a cancellation request with reason (Non-admin users)",
)
def request_booking_cancellation(
    booking_id: str,
    payload: CancellationRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Database = Depends(get_database),
):
    """Submit a formal cancellation request requiring administrator approval.
    Any non-admin user (staff, intern, guest, volunteer) can submit a request."""
    # Admins and Supervisors already have immediate cancellation power via DELETE
    if _is_admin_or_supervisor(current_user):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admins and Supervisors have direct cancellation privileges. Please use direct cancellation (DELETE /bookings/{booking_id}) instead.",
        )

    booking_doc = db["bookings"].find_one({"_id": booking_id})
    if not booking_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )

    if booking_doc["status"] == BookingStatus.CANCELLED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Booking is already cancelled",
        )

    if booking_doc["status"] == BookingStatus.CANCELLATION_PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A cancellation request is already pending review",
        )

    cancel_req = CancellationRequest(
        requested_by=current_user.id,
        reason=payload.reason.strip(),
        requested_at=datetime.now(timezone.utc),
        status=RequestStatus.PENDING,
    )

    db["bookings"].update_one(
        {"_id": booking_id},
        {
            "$set": {
                "status": BookingStatus.CANCELLATION_PENDING.value,
                "cancellation_request": cancel_req.model_dump(),
            }
        },
    )
    booking_doc = db["bookings"].find_one({"_id": booking_id})

    _log_action(
        db=db,
        actor_id=current_user.id,
        actor_role=_get_user_primary_role(current_user),
        action="REQUEST_CANCELLATION",
        document_id=booking_id,
        metadata={"reason": payload.reason},
    )

    return Booking(**booking_doc)


@router.post(
    "/{booking_id}/cancel-review",
    response_model=Booking,
    summary="Review and approve/reject a cancellation request (Admin & Supervisor only)",
)
def review_cancellation_request(
    booking_id: str,
    payload: CancellationReview,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_roles(RoleName.ADMIN, RoleName.SUPERVISOR)),
    db: Database = Depends(get_database),
):
    """Approve or reject a pending cancellation request."""
    booking_doc = db["bookings"].find_one({"_id": booking_id})
    if not booking_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )

    existing_req = booking_doc.get("cancellation_request")
    if not existing_req or existing_req.get("status") != RequestStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending cancellation request found for this booking",
        )

    now = datetime.now(timezone.utc)
    new_booking_status = (
        BookingStatus.CANCELLED.value
        if payload.action == RequestStatus.APPROVED
        else BookingStatus.CONFIRMED.value
    )

    update_doc = {
        "status": new_booking_status,
        "cancellation_request.status": payload.action.value,
        "cancellation_request.reviewed_by": current_user.id,
        "cancellation_request.reviewed_at": now,
    }
    if payload.admin_notes:
        update_doc["cancellation_request.admin_notes"] = payload.admin_notes.strip()

    db["bookings"].update_one({"_id": booking_id}, {"$set": update_doc})
    booking_doc = db["bookings"].find_one({"_id": booking_id})

    _log_action(
        db=db,
        actor_id=current_user.id,
        actor_role=_get_user_primary_role(current_user),
        action=f"CANCELLATION_{payload.action.value.upper()}",
        document_id=booking_id,
        metadata={"admin_notes": payload.admin_notes},
    )

    if payload.action == RequestStatus.APPROVED:
        background_tasks.add_task(
            send_booking_cancelled_notification,
            db=db,
            booking=Booking(**booking_doc),
            cancelled_by=current_user,
            reason=f"Approved cancellation request. {payload.admin_notes or ''}".strip(),
        )

    return Booking(**booking_doc)
