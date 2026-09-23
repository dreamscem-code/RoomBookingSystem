#!/usr/bin/env python3
"""
Seed script for Room Booking System.
Initializes database indexes, default administrator account, and starter rooms.

Usage:
    python seed.py
    python seed.py --admin-email admin@example.com --admin-password CustomPass123!
"""

import argparse
import sys
import uuid
from datetime import datetime, timezone

from app.config import settings
from app.db import close_db_connection, get_database, init_db_indexes
from app.schemas.common import RoleName, Team, UserType
from app.schemas.room import Room
from app.schemas.user import Profile, UserInDB, UserRole
from app.security import hash_password


STARTER_ROOMS = [
    {
        "name": "Conference Room A",
        "amenities": ["Projector", "Video Conferencing", "Whiteboard", "Air Conditioning"],
        "is_active": True,
    },
    {
        "name": "Boardroom Alpha",
        "amenities": ["TV Display", "Video Conferencing", "Sound System", "Ergonomic Seating"],
        "is_active": True,
    },
    {
        "name": "Brainstorming Pod 1",
        "amenities": ["Whiteboard", "High-Speed Wi-Fi", "Air Conditioning"],
        "is_active": True,
    },
    {
        "name": "Training Hall",
        "amenities": ["Projector", "Microphone", "Sound System", "Wheelchair Accessible"],
        "is_active": True,
    },
]


def seed_database(admin_email: str, admin_password: str, create_rooms: bool = True):
    print("=" * 60)
    print("Room Booking System - Database Initialization & Seeding")
    print("=" * 60)
    print(f"Connecting to database: {settings.DB_NAME}...")

    db = get_database()

    # 1. Initialize DB Indexes
    print("Ensuring database indexes...")
    init_db_indexes(db)
    print("✓ Database indexes initialized.")

    # 2. Seed Administrator User
    users_col = db["users"]
    clean_email = admin_email.strip().lower()
    existing_admin = users_col.find_one({"email": clean_email})

    if existing_admin:
        print(f"ℹ Admin user with email '{clean_email}' already exists.")
        # Ensure admin role is assigned
        roles = existing_admin.get("roles", [])
        role_names = [r.get("role_name") for r in roles]
        if RoleName.ADMIN.value not in role_names:
            print("  Assigning missing 'admin' role to existing user...")
            roles.append({
                "role_id": str(uuid.uuid4()),
                "role_name": RoleName.ADMIN.value,
                "assigned_at": datetime.now(timezone.utc),
            })
            users_col.update_one({"_id": existing_admin["_id"]}, {"$set": {"roles": roles}})
            print("  ✓ Admin role added.")
    else:
        print(f"Creating administrator user '{clean_email}'...")
        admin_id = str(uuid.uuid4())
        admin_user = UserInDB(
            _id=admin_id,
            email=clean_email,
            user_type=UserType.FULL_TIME,
            team=Team.MANAGEMENT,
            is_active=True,
            profile=Profile(
                first_name="System",
                last_name="Administrator",
                phone="+852 1234 5678",
            ),
            roles=[
                UserRole(role_id=str(uuid.uuid4()), role_name=RoleName.ADMIN),
                UserRole(role_id=str(uuid.uuid4()), role_name=RoleName.SUPERVISOR),
            ],
            hashed_password=hash_password(admin_password),
            created_at=datetime.now(timezone.utc),
        )
        users_col.insert_one(admin_user.to_mongo())
        print(f"✓ Administrator created successfully!")
        print(f"   Email:    {clean_email}")
        print(f"   Password: {admin_password}")

    # 3. Seed Starter Rooms (if empty)
    rooms_col = db["rooms"]
    existing_rooms_count = rooms_col.count_documents({})

    if existing_rooms_count == 0 and create_rooms:
        print(f"\nNo rooms found. Seeding {len(STARTER_ROOMS)} starter rooms...")
        for r_data in STARTER_ROOMS:
            room_id = str(uuid.uuid4())
            room = Room(
                _id=room_id,
                name=r_data["name"],
                amenities=r_data["amenities"],
                is_active=r_data["is_active"],
                created_at=datetime.now(timezone.utc),
            )
            rooms_col.insert_one(room.to_mongo())
            print(f"✓ Room created: {room.name} ({', '.join(room.amenities)})")
    else:
        print(f"\nℹ Rooms collection already contains {existing_rooms_count} room(s). Skipping room seed.")

    close_db_connection()
    print("\n" + "=" * 60)
    print("Database seeding completed successfully!")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Seed Room Booking System database with admin and rooms.")
    parser.add_argument(
        "--admin-email",
        default="admin@roombooking.com",
        help="Administrator email address (default: admin@roombooking.com)",
    )
    parser.add_argument(
        "--admin-password",
        default="Admin123!",
        help="Administrator password (default: Admin123!)",
    )
    parser.add_argument(
        "--skip-rooms",
        action="store_true",
        help="Skip inserting starter rooms",
    )

    args = parser.parse_args()
    seed_database(
        admin_email=args.admin_email,
        admin_password=args.admin_password,
        create_rooms=not args.skip_rooms,
    )


if __name__ == "__main__":
    main()
