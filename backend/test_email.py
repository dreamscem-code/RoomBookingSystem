"""
Test script for verifying email notifications in the Room Booking System.

Usage:
  1. Test with local mock (default when SMTP credentials are not in .env):
     python test_email.py

  2. Test sending a REAL email to your personal inbox (if SMTP credentials are in .env):
     python test_email.py your_email@example.com
"""

import sys
import uuid
from datetime import datetime, timedelta, timezone

from app.config import settings
from app.db import get_database
from app.schemas.booking import Attendee, Booking, TimeSlot
from app.schemas.common import Team, UserType
from app.schemas.user import Profile, User
from app.services.notification import (
    _send_email_smtp,
    send_booking_cancelled_notification,
    send_booking_created_notification,
)


def print_header(title: str) -> None:
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def test_smtp_configuration() -> None:
    print_header("1. Checking SMTP Configuration")
    print(f"SMTP Host:      {settings.SMTP_HOST or '(Not set - using Mock Dev Mode)'}")
    print(f"SMTP Port:      {settings.SMTP_PORT}")
    print(f"SMTP User:      {settings.SMTP_USER or '(Not set)'}")
    print(f"SMTP TLS:       {settings.SMTP_TLS}")
    print(f"Sender Email:   {settings.EMAILS_FROM_EMAIL}")
    print(f"Sender Name:    {settings.EMAILS_FROM_NAME}")

    if not settings.SMTP_HOST or not settings.SMTP_USER:
        print("\nℹ️  Notice: Real SMTP credentials are not set in .env.")
        print("   Emails will be displayed in console and saved to MongoDB 'notification_logs'.")
        print("   To send REAL emails (e.g. via Gmail App Password), set in .env:")
        print("     SMTP_HOST=smtp.gmail.com")
        print("     SMTP_PORT=587")
        print("     SMTP_USER=your_email@gmail.com")
        print("     SMTP_PASSWORD=your_16_char_app_password")
    else:
        print("\n✅ SMTP credentials found. Real emails can be dispatched.")


def test_direct_email_send(target_email: str) -> bool:
    print_header(f"2. Testing Direct Email Send to: {target_email}")
    subject = "Test Email from Room Booking System"
    text_content = (
        "Hello!\n\n"
        "This is a verification test email from the Room Booking System notification service.\n"
        f"Sent at: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}\n\n"
        "If you see this, the email dispatch mechanism is working properly!"
    )
    html_content = f"""
    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #cbd5e0; border-radius: 8px;">
        <h2 style="color: #3182ce;">Room Booking System Test</h2>
        <p>This is a verification test email from the notification service.</p>
        <p><strong>Sent at:</strong> {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
        <p style="color: #38a169; font-weight: bold;">Status: Delivery mechanism verified.</p>
    </div>
    """

    success = _send_email_smtp(
        to_email=target_email,
        subject=subject,
        text_content=text_content,
        html_content=html_content,
    )
    print(f"Direct send result: {'SUCCESS' if success else 'FAILED'}")
    return success


def test_booking_created_notification_flow(target_email: str) -> None:
    print_header("3. Testing Booking Creation Notification Flow")
    db = get_database()
    users_col = db["users"]

    # Create / update a test organizer
    organizer_id = str(uuid.uuid4())
    organizer = User(
        _id=organizer_id,
        email=target_email,
        user_type=UserType.FULL_TIME,
        team=Team.MANAGEMENT,
        is_active=True,
        profile=Profile(first_name="Test", last_name="Organizer"),
        roles=[],
        created_at=datetime.now(timezone.utc),
    )
    users_col.insert_one(organizer.to_mongo())

    # Create / update a test attendee
    attendee_id = str(uuid.uuid4())
    attendee_email = f"attendee_{uuid.uuid4().hex[:6]}@example.com"
    attendee = User(
        _id=attendee_id,
        email=attendee_email,
        user_type=UserType.FULL_TIME,
        team=Team.MANAGEMENT,
        is_active=True,
        profile=Profile(first_name="Alex", last_name="Participant"),
        roles=[],
        created_at=datetime.now(timezone.utc),
    )
    users_col.insert_one(attendee.to_mongo())

    # Create dummy booking
    booking_id = str(uuid.uuid4())
    start = datetime.now(timezone.utc) + timedelta(days=1)
    end = start + timedelta(hours=1)
    dummy_booking = Booking(
        _id=booking_id,
        room_id="room_alpha",
        room_name="Boardroom Alpha",
        created_by=organizer_id,
        title="Annual Strategy & Planning",
        time_slot=TimeSlot(start=start, end=end),
        attendees=[Attendee(user_id=attendee_id, role="attendee")],
        created_at=datetime.now(timezone.utc),
    )

    print(f"Triggering booking notification for: '{dummy_booking.title}' in {dummy_booking.room_name}")
    send_booking_created_notification(
        db=db,
        booking=dummy_booking,
        organizer=organizer,
        notify_team=False,
    )

    # Verify log entry in MongoDB
    logs = list(db["notification_logs"].find({"recipient_id": organizer_id}).sort("created_at", -1))
    if logs:
        print(f"✅ Found {len(logs)} notification log entry in 'notification_logs' for organizer!")
        print(f"   Log Title:   {logs[0].get('title')}")
        print(f"   Log Channel: {logs[0].get('channel')}")
        print(f"   Log Status:  {logs[0].get('status')}")
    else:
        print("❌ No notification log found in database!")

    # Clean up test user records
    users_col.delete_many({"_id": {"$in": [organizer_id, attendee_id]}})
    print("Cleaned up temporary test user documents.")


def main():
    target_email = sys.argv[1] if len(sys.argv) > 1 else "test_recipient@example.com"

    print("============================================================")
    print("  ROOM BOOKING SYSTEM - EMAIL & NOTIFICATION TEST SUITE")
    print("============================================================")

    test_smtp_configuration()
    test_direct_email_send(target_email)
    test_booking_created_notification_flow(target_email)

    print("\n" + "=" * 60)
    print("  ALL EMAIL & NOTIFICATION TESTS FINISHED")
    print("============================================================")


if __name__ == "__main__":
    main()
