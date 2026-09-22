import logging
import smtplib
import uuid
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from typing import Dict, List, Optional, Set
from pymongo.database import Database

from app.config import settings
from app.schemas.booking import Booking
from app.schemas.common import NotificationChannel
from app.schemas.user import User

logger = logging.getLogger("uvicorn")


def _format_datetime(dt: datetime) -> str:
    """Format datetime into human-readable string."""
    return dt.strftime("%A, %b %d, %Y at %I:%M %p UTC")


def _send_email_smtp(
    to_email: str,
    subject: str,
    text_content: str,
    html_content: Optional[str] = None,
    reply_to: Optional[str] = None,
) -> bool:
    """Send an email using SMTP. If SMTP is not configured, logs to console (dev mode)."""
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.info(
            f"[DEV EMAIL MOCK] To: {to_email} | Subject: '{subject}' | Reply-To: {reply_to or 'N/A'}\n"
            f"--- Content ---\n{text_content}\n---------------"
        )
        return True

    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
        msg["To"] = to_email
        msg["Date"] = formatdate(localtime=True)
        msg["Message-ID"] = make_msgid()
        if reply_to:
            msg["Reply-To"] = reply_to
        msg.set_content(text_content)

        if html_content:
            msg.add_alternative(html_content, subtype="html")

        smtp_user = settings.SMTP_USER.strip() if settings.SMTP_USER else ""
        smtp_pass = settings.SMTP_PASSWORD.replace("\xa0", "").replace(" ", "").strip() if settings.SMTP_PASSWORD else ""

        if settings.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                if settings.SMTP_TLS:
                    server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)

        logger.info(f"Email successfully dispatched to {to_email}")
        return True
    except Exception as exc:
        logger.error(f"Failed to send email to {to_email}: {exc}")
        return False


def _log_notification(
    db: Database,
    recipient_id: str,
    title: str,
    message: str,
    channel: NotificationChannel = NotificationChannel.EMAIL,
    status: str = "unread",
) -> None:
    """Persist notification record to notification_logs collection."""
    try:
        db["notification_logs"].insert_one(
            {
                "_id": str(uuid.uuid4()),
                "recipient_id": recipient_id,
                "channel": channel.value if hasattr(channel, "value") else channel,
                "title": title,
                "message": message,
                "status": status,
                "created_at": datetime.now(timezone.utc),
                "read_at": None,
            }
        )
    except Exception as exc:
        logger.warning(f"Could not persist notification log: {exc}")


def send_booking_created_notification(
    db: Database,
    booking: Booking,
    organizer: User,
    notify_team: bool = True,
) -> None:
    """Notify organizer, listed attendees, and team/organization members about a new booking."""
    users_col = db["users"]

    # 1. Collect unique recipient user IDs
    recipient_ids: Set[str] = {organizer.id}

    # Add all attendees listed in the booking
    for att in booking.attendees:
        if att.user_id:
            recipient_ids.add(att.user_id)

    # Add other colleagues in the same team/organization
    if notify_team and organizer.team:
        team_members = users_col.find(
            {"team": organizer.team.value, "is_active": True},
            {"_id": 1},
        )
        for tm in team_members:
            recipient_ids.add(tm["_id"])

    # 2. Fetch full user profiles for recipient emails
    recipient_docs = list(users_col.find({"_id": {"$in": list(recipient_ids)}, "is_active": True}))

    # Map user id to display names for attendee list
    all_user_names: Dict[str, str] = {}
    for doc in recipient_docs:
        prof = doc.get("profile", {})
        all_user_names[doc["_id"]] = f"{prof.get('first_name', '')} {prof.get('last_name', '')}".strip() or doc.get("email")

    organizer_name = f"{organizer.profile.first_name} {organizer.profile.last_name}".strip()

    # Form attendee names string
    attendee_names = [all_user_names.get(att.user_id, att.user_id) for att in booking.attendees]
    attendees_str = ", ".join(attendee_names) if attendee_names else "None listed"

    # 3. Prepare email content
    start_str = _format_datetime(booking.time_slot.start)
    end_str = _format_datetime(booking.time_slot.end)
    subject = f"Room Booking Confirmed: '{booking.title}' in {booking.room_name}"

    text_body = f"""Hello,

A new room booking has been scheduled:

  Meeting:    {booking.title}
  Room:       {booking.room_name}
  Start Time: {start_str}
  End Time:   {end_str}
  Organizer:  {organizer_name} ({organizer.email})
  Team:       {organizer.team.value if organizer.team else 'General'}
  Attendees:  {attendees_str}

This meeting has been reserved in the Room Booking System.

Best regards,
Room Booking Team
"""

    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2b6cb0; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Room Booking Confirmed</h2>
        <p>A new meeting room booking has been confirmed:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <tr><td style="padding: 8px; font-weight: bold; width: 120px;">Meeting:</td><td style="padding: 8px;">{booking.title}</td></tr>
            <tr style="background-color: #f7fafc;"><td style="padding: 8px; font-weight: bold;">Room:</td><td style="padding: 8px;">{booking.room_name}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Start Time:</td><td style="padding: 8px;">{start_str}</td></tr>
            <tr style="background-color: #f7fafc;"><td style="padding: 8px; font-weight: bold;">End Time:</td><td style="padding: 8px;">{end_str}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Organizer:</td><td style="padding: 8px;">{organizer_name} ({organizer.email})</td></tr>
            <tr style="background-color: #f7fafc;"><td style="padding: 8px; font-weight: bold;">Team:</td><td style="padding: 8px;">{organizer.team.value if organizer.team else 'General'}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Attendees:</td><td style="padding: 8px;">{attendees_str}</td></tr>
        </table>
        <p style="color: #718096; font-size: 13px; margin-top: 20px;">This is an automated notification from the Room Booking System.</p>
    </div>
    """

    # 4. Dispatch to each recipient and record in notification_logs
    for user_doc in recipient_docs:
        user_email = user_doc.get("email")
        user_id = user_doc.get("_id")
        if not user_email:
            continue

        success = _send_email_smtp(
            to_email=user_email,
            subject=subject,
            text_content=text_body,
            html_content=html_body,
            reply_to=organizer.email,
        )

        _log_notification(
            db=db,
            recipient_id=user_id,
            title=subject,
            message=f"Booking '{booking.title}' in {booking.room_name} from {start_str} to {end_str}",
            channel=NotificationChannel.EMAIL,
            status="sent" if success else "failed",
        )


def send_booking_cancelled_notification(
    db: Database,
    booking: Booking,
    cancelled_by: User,
    reason: Optional[str] = None,
) -> None:
    """Notify ALL active users in the organisation when a booking is cancelled."""
    users_col = db["users"]

    # Fetch every active user in the org so the whole organisation is informed
    recipient_docs = list(users_col.find({"is_active": True}, {"_id": 1, "email": 1}))

    subject = f"Booking Cancelled: '{booking.title}' in {booking.room_name}"
    start_str = _format_datetime(booking.time_slot.start)
    end_str = _format_datetime(booking.time_slot.end)
    reason_str = f"\n  Reason:     {reason}" if reason else ""

    cancelled_by_name = (
        f"{cancelled_by.profile.first_name} {cancelled_by.profile.last_name}".strip()
        if cancelled_by.profile
        else cancelled_by.email
    )

    text_body = f"""Hello,

The following room booking has been cancelled:

  Meeting:      {booking.title}
  Room:         {booking.room_name}
  Start Time:   {start_str}
  End Time:     {end_str}
  Cancelled By: {cancelled_by_name} ({cancelled_by.email}){reason_str}

If you had this time slot blocked, please update your calendar accordingly.

Best regards,
Room Booking Team
"""

    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #c53030; border-bottom: 2px solid #fed7d7; padding-bottom: 8px;">&#10060; Booking Cancelled</h2>
        <p>A room booking has been cancelled. Details below:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <tr><td style="padding: 8px; font-weight: bold; width: 140px;">Meeting:</td><td style="padding: 8px;">{booking.title}</td></tr>
            <tr style="background-color: #fff5f5;"><td style="padding: 8px; font-weight: bold;">Room:</td><td style="padding: 8px;">{booking.room_name}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Start Time:</td><td style="padding: 8px;">{start_str}</td></tr>
            <tr style="background-color: #fff5f5;"><td style="padding: 8px; font-weight: bold;">End Time:</td><td style="padding: 8px;">{end_str}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Cancelled By:</td><td style="padding: 8px;">{cancelled_by_name} ({cancelled_by.email})</td></tr>
            {"<tr style='background-color: #fff5f5;'><td style='padding: 8px; font-weight: bold;'>Reason:</td><td style='padding: 8px;'>" + reason + "</td></tr>" if reason else ""}
        </table>
        <p style="color: #718096; font-size: 13px; margin-top: 20px;">This is an automated notification from the Room Booking System.</p>
    </div>
    """

    for user_doc in recipient_docs:
        user_email = user_doc.get("email")
        user_id = user_doc.get("_id")
        if not user_email:
            continue

        success = _send_email_smtp(
            to_email=user_email,
            subject=subject,
            text_content=text_body,
            html_content=html_body,
            reply_to=cancelled_by.email,
        )
        _log_notification(
            db=db,
            recipient_id=user_id,
            title=subject,
            message=f"Booking '{booking.title}' was cancelled by {cancelled_by.email}. {reason or ''}",
            channel=NotificationChannel.EMAIL,
            status="sent" if success else "failed",
        )


def send_cancellation_requested_notification(
    db: Database,
    booking: Booking,
    requested_by: User,
    reason: str,
) -> None:
    """Notify all Admins and Supervisors when a staff member requests a booking cancellation."""
    users_col = db["users"]

    # Query all active admins and supervisors
    admin_docs = list(
        users_col.find(
            {
                "is_active": True,
                "roles.role_name": {"$in": ["admin", "supervisor"]},
            },
            {"_id": 1, "email": 1, "profile": 1},
        )
    )

    if not admin_docs:
        logger.warning("No active admins or supervisors found to notify for cancellation request.")
        return

    requester_name = (
        f"{requested_by.profile.first_name} {requested_by.profile.last_name}".strip()
        if requested_by.profile
        else requested_by.email
    )

    subject = f"Cancellation Request: '{booking.title}' in {booking.room_name}"
    start_str = _format_datetime(booking.time_slot.start)
    end_str = _format_datetime(booking.time_slot.end)

    text_body = f"""Hello Administrator,

A user has requested to cancel the following room booking and requires your review:

  Meeting:       {booking.title}
  Room:          {booking.room_name}
  Start Time:    {start_str}
  End Time:      {end_str}
  Requested By:  {requester_name} ({requested_by.email})
  Reason:        {reason}

Please log into the Room Booking System to approve or reject this cancellation request.

Best regards,
Room Booking System
"""

    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #d97706; border-bottom: 2px solid #fde68a; padding-bottom: 8px;">⚠️ Cancellation Request Awaiting Review</h2>
        <p>A user has requested to cancel a room booking. Review details below:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <tr><td style="padding: 8px; font-weight: bold; width: 140px;">Meeting:</td><td style="padding: 8px;">{booking.title}</td></tr>
            <tr style="background-color: #fffbeb;"><td style="padding: 8px; font-weight: bold;">Room:</td><td style="padding: 8px;">{booking.room_name}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Start Time:</td><td style="padding: 8px;">{start_str}</td></tr>
            <tr style="background-color: #fffbeb;"><td style="padding: 8px; font-weight: bold;">End Time:</td><td style="padding: 8px;">{end_str}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Requested By:</td><td style="padding: 8px;">{requester_name} ({requested_by.email})</td></tr>
            <tr style="background-color: #fffbeb;"><td style="padding: 8px; font-weight: bold;">Reason:</td><td style="padding: 8px; color: #b45309; font-weight: bold;">{reason}</td></tr>
        </table>
        <p style="color: #718096; font-size: 13px; margin-top: 20px;">Please log in to the admin panel to review and approve or reject this request.</p>
    </div>
    """

    for admin in admin_docs:
        admin_email = admin.get("email")
        admin_id = admin.get("_id")
        if not admin_email:
            continue

        success = _send_email_smtp(
            to_email=admin_email,
            subject=subject,
            text_content=text_body,
            html_content=html_body,
            reply_to=requested_by.email,
        )
        _log_notification(
            db=db,
            recipient_id=admin_id,
            title=subject,
            message=f"Cancellation request by {requested_by.email} for '{booking.title}' ({booking.room_name}). Reason: {reason}",
            channel=NotificationChannel.EMAIL,
            status="sent" if success else "failed",
        )
