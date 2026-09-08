import os
from typing import Optional
from dotenv import load_dotenv
from pymongo import ASCENDING, DESCENDING, IndexModel, MongoClient
from pymongo.database import Database

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI") or os.getenv("MONGO_URL") or "mongodb://localhost:27017"
DB_NAME = os.getenv("MONGO_DB_NAME", "RoomBookingDB")

_client: Optional[MongoClient] = None


def get_client() -> MongoClient:
    """Return or initialize the PyMongo client singleton."""
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URI)
    return _client


def get_database(name: Optional[str] = None) -> Database:
    """Return database handle."""
    client = get_client()
    return client[name or DB_NAME]


def close_db_connection() -> None:
    """Close MongoClient connection."""
    global _client
    if _client is not None:
        _client.close()
        _client = None


# --- Index Initialization for PyMongo ---

def init_db_indexes(db: Database) -> None:
    """Create all required PyMongo indexes and constraints across collections."""

    # users
    db["users"].create_indexes([
        IndexModel([("email", ASCENDING)], unique=True, name="uniq_user_email"),
    ])

    # rooms
    db["rooms"].create_indexes([
        IndexModel([("is_active", ASCENDING)], name="idx_room_active"),
    ])

    # bookings
    db["bookings"].create_indexes([
        IndexModel([("room_id", ASCENDING)], name="idx_booking_room_id"),
        IndexModel([("created_by", ASCENDING)], name="idx_booking_created_by"),
        IndexModel(
            [
                ("room_id", ASCENDING),
                ("time_slot.start", ASCENDING),
                ("time_slot.end", ASCENDING),
            ],
            name="idx_room_schedule_conflict",
        ),
        IndexModel(
            [("cancellation_request.status", ASCENDING)],
            name="idx_cancellation_status",
            sparse=True,
        ),
    ])

    # action_logs
    db["action_logs"].create_indexes([
        IndexModel([("timestamp", ASCENDING)], name="idx_action_timestamp"),
        IndexModel(
            [("actor.user_id", ASCENDING), ("timestamp", DESCENDING)],
            name="idx_actor_audit_trail",
        ),
        IndexModel([("action", ASCENDING)], name="idx_action_type"),
    ])

    # notification_logs
    db["notification_logs"].create_indexes([
        IndexModel([("recipient_id", ASCENDING)], name="idx_notification_recipient"),
        IndexModel(
            [("created_at", ASCENDING)],
            expireAfterSeconds=5184000,  # TTL Index: 60 days
            name="ttl_notification_60d",
        ),
    ])

    # room_issue_reports
    db["room_issue_reports"].create_indexes([
        IndexModel([("room_id", ASCENDING)], name="idx_report_room_id"),
        IndexModel([("reported_by", ASCENDING)], name="idx_report_reporter"),
        IndexModel([("status", ASCENDING)], name="idx_report_status"),
    ])
