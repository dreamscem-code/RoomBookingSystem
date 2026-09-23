import React, { useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  Building,
  Users,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Pencil,
  XCircle,
  Tag,
  Check,
  Tv,
  Presentation,
  Wifi,
  Sparkles,
} from 'lucide-react';
import {
  formatHKDate,
  formatHKTimeRange,
  parseIsoDate,
} from '../utils/timezone';

/**
 * Calculates human-readable duration between two ISO timestamps.
 */
function calculateDuration(startIso, endIso) {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) return '';
  const diffMs = end - start;
  if (diffMs <= 0) return '';
  const totalMins = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0 && mins > 0) return `${hours} hr${hours > 1 ? 's' : ''} ${mins} min${mins > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hr${hours > 1 ? 's' : ''}`;
  return `${mins} min${mins > 1 ? 's' : ''}`;
}

/**
 * Maps amenities to appropriate icon representations.
 */
function getAmenityIcon(amenity) {
  const a = amenity.toLowerCase();
  if (a.includes('projector') || a.includes('screen')) return <Presentation className="w-3.5 h-3.5" />;
  if (a.includes('tv') || a.includes('display') || a.includes('monitor')) return <Tv className="w-3.5 h-3.5" />;
  if (a.includes('wifi') || a.includes('internet')) return <Wifi className="w-3.5 h-3.5" />;
  return <Tag className="w-3.5 h-3.5" />;
}

export default function BookingDetailsModal({
  booking,
  rooms = [],
  currentUserId = null,
  currentUserEmail = null,
  isAdminOrSupervisor = false,
  onClose,
  onEdit,
  onCancel,
  onReview,
}) {
  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!booking) return null;

  // Match room details
  const matchedRoom = rooms.find(
    (r) =>
      (r._id && r._id === booking.room_id) ||
      (r.id && r.id === booking.room_id) ||
      r.name === booking.room_name
  );

  const durationStr = calculateDuration(booking.time_slot?.start, booking.time_slot?.end);
  const formattedDate = formatHKDate(booking.time_slot?.start);
  const formattedTimeRange = formatHKTimeRange(booking.time_slot?.start, booking.time_slot?.end);

  const isOwner =
    currentUserId && (booking.created_by === currentUserId || booking.creator_email === currentUserEmail);
  const canModify = isOwner || isAdminOrSupervisor;

  // Status computation
  const now = new Date();
  const startTime = parseIsoDate(booking.time_slot?.start);
  const endTime = parseIsoDate(booking.time_slot?.end);
  const isPast = endTime && now > endTime;
  const isInProgress = startTime && endTime && now >= startTime && now <= endTime;

  let statusConfig = {
    label: 'Confirmed',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
  };

  if (booking.status === 'cancelled') {
    statusConfig = {
      label: 'Cancelled',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      dotClass: 'bg-rose-500',
    };
  } else if (booking.status === 'cancellation_pending') {
    statusConfig = {
      label: 'Cancellation Pending Review',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 font-semibold',
      dotClass: 'bg-amber-500 animate-pulse',
    };
  } else if (isInProgress) {
    statusConfig = {
      label: 'In Progress Now',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold',
      dotClass: 'bg-emerald-500 animate-ping',
    };
  } else if (isPast) {
    statusConfig = {
      label: 'Completed',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
      dotClass: 'bg-slate-400',
    };
  } else {
    statusConfig = {
      label: 'Upcoming Reservation',
      badgeClass: 'bg-blue-50 text-[#1977cc] border-blue-200 font-medium',
      dotClass: 'bg-[#1977cc]',
    };
  }

  const attendees = Array.isArray(booking.attendees) ? booking.attendees : [];
  const organizerDisplayName = booking.creator_name || booking.creator_email || 'Staff Member';
  const organizerInitial = organizerDisplayName.charAt(0).toUpperCase();

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Banner & Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/60">
          <div className="flex items-center space-x-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#1977cc] to-sky-400 text-white flex items-center justify-center shadow-sm shrink-0">
              <Building className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-slate-900 truncate">
                  {booking.room_name}
                </h2>
                {matchedRoom?.is_active === false && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                    Deactivated Room
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 flex items-center space-x-1.5 mt-0.5">
                <span>Hong Kong Standard Time (HKT UTC+8)</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Status Pill */}
            <span
              className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusConfig.badgeClass}`}
            >
              <span className={`w-2 h-2 rounded-full ${statusConfig.dotClass}`} />
              <span>{statusConfig.label}</span>
            </span>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* 1. Meeting Title & Purpose */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Meeting Title or Purpose
            </span>
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50/50 via-sky-50/30 to-slate-50 border border-blue-100/80">
              <h3 className="text-lg font-bold text-slate-900 leading-snug">
                {booking.title}
              </h3>
            </div>
          </div>

          {/* 2. Schedule Grid: Date, Time & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Date Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-white text-[#1977cc] shadow-2xs shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Date</p>
                <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">{formattedDate}</p>
              </div>
            </div>

            {/* Time Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-white text-[#1977cc] shadow-2xs shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Time Slot</p>
                <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">{formattedTimeRange}</p>
              </div>
            </div>

            {/* Duration Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-white text-emerald-600 shadow-2xs shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Duration</p>
                <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">{durationStr || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* 3. Room Amenities & Facilities */}
          {matchedRoom && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <Building className="w-3.5 h-3.5 text-[#1977cc]" />
                  <span>Room Features & Equipment</span>
                </span>
                {matchedRoom.capacity && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    Max Capacity: {matchedRoom.capacity} People
                  </span>
                )}
              </div>

              {matchedRoom.amenities && matchedRoom.amenities.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {matchedRoom.amenities.map((amenity, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 shadow-2xs"
                    >
                      <span className="text-[#1977cc]">{getAmenityIcon(amenity)}</span>
                      <span>{amenity}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  Standard room facilities available.
                </p>
              )}
            </div>
          )}

          {/* 4. Organizer / Host Profile Card */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Organizer & Host
            </span>
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-700 to-slate-900 text-white flex items-center justify-center text-sm font-bold shadow-sm shrink-0">
                  {organizerInitial}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {organizerDisplayName}
                    </p>
                    {isOwner && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#1977cc]/10 text-[#1977cc]">
                        You
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    {booking.creator_email || 'No email specified'}
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#1977cc] text-xs font-semibold shrink-0 border border-blue-100/80">
                Organizer (Host)
              </span>
            </div>
          </div>

          {/* 5. Attendees & Invitees List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Users className="w-3.5 h-3.5 text-[#1977cc]" />
                <span>Invited Attendees ({attendees.length})</span>
              </span>
              <span className="text-xs text-slate-500">
                Total attendance: {attendees.length + 1} (including host)
              </span>
            </div>

            {attendees.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500 bg-slate-50/50">
                No additional attendees were specified for this booking.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
                {attendees.map((att, idx) => {
                  const displayName = att.name || att.email || `Attendee ${idx + 1}`;
                  const initial = displayName.charAt(0).toUpperCase();
                  const isCoHost = att.role === 'co-host';

                  return (
                    <div
                      key={att.user_id || idx}
                      className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between space-x-2"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-2xs ${
                            isCoHost
                              ? 'bg-gradient-to-tr from-amber-500 to-amber-600'
                              : 'bg-gradient-to-tr from-[#1977cc] to-sky-400'
                          }`}
                        >
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            {displayName}
                          </p>
                          {att.email && att.email !== displayName && (
                            <p className="text-[11px] text-slate-400 truncate">
                              {att.email}
                            </p>
                          )}
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0 ${
                          isCoHost
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isCoHost ? 'Co-host' : 'Attendee'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 6. Cancellation Details (if cancellation requested or completed) */}
          {booking.cancellation_request && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-1.5">
              <div className="flex items-center space-x-1.5 text-amber-800 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Cancellation Request Details</span>
              </div>
              <p className="text-amber-900">
                <strong>Reason:</strong> {booking.cancellation_request.reason || 'None provided'}
              </p>
              {booking.cancellation_request.admin_notes && (
                <p className="text-amber-800">
                  <strong>Admin Notes:</strong> {booking.cancellation_request.admin_notes}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-medium transition cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center space-x-2">
            {/* Admin Review Action */}
            {booking.status === 'cancellation_pending' && isAdminOrSupervisor && onReview && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onReview(booking);
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition cursor-pointer flex items-center space-x-1.5 shadow-sm"
              >
                <span>Review Request</span>
              </button>
            )}

            {/* Edit / Reschedule Action */}
            {booking.status === 'confirmed' && !isPast && canModify && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(booking);
                }}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition cursor-pointer flex items-center space-x-1.5 shadow-2xs"
              >
                <Pencil className="w-3.5 h-3.5 text-[#1977cc]" />
                <span>Edit / Reschedule</span>
              </button>
            )}

            {/* Cancel Action */}
            {booking.status === 'confirmed' && !isPast && (isOwner || isAdminOrSupervisor) && onCancel && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCancel(booking);
                }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                  isAdminOrSupervisor
                    ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                <XCircle className="w-4 h-4" />
                <span>{isAdminOrSupervisor ? 'Cancel Booking' : 'Request Cancellation'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
