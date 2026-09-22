import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { bookingsApi, roomsApi } from '../api';
import {
  Calendar,
  Clock,
  Building,
  Users,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  User as UserIcon,
  X,
  XCircle,
  Sparkles,
} from 'lucide-react';

export const ScheduleView = () => {
  const { user } = useAuth();

  // State for today's bookings
  const [todayBookings, setTodayBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [includeCancelled, setIncludeCancelled] = useState(false);

  // Role detection
  const isAdminOrSupervisor = user?.roles?.some((r) =>
    ['admin', 'supervisor'].includes(r.role_name?.toLowerCase())
  );

  // State for booking modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [formData, setFormData] = useState({
    roomId: '',
    title: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '10:00',
    endTime: '11:00',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  // State for cancellation request modal (Staff / Non-Admin)
  const [cancelModalBooking, setCancelModalBooking] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  // State for Review Cancellation Modal (Admin / Supervisor)
  const [reviewModalBooking, setReviewModalBooking] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  // Fetch today's bookings
  const fetchTodayBookings = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const data = await bookingsApi.getToday({ include_cancelled: includeCancelled });
      setTodayBookings(data || []);
    } catch (err) {
      console.error("Failed to load today's bookings:", err);
      setError(err.message || 'Unable to retrieve today bookings.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [includeCancelled]);

  useEffect(() => {
    fetchTodayBookings();
  }, [fetchTodayBookings]);

  // Load available rooms when modal opens
  useEffect(() => {
    if (isModalOpen && rooms.length === 0) {
      roomsApi.list()
        .then((data) => {
          const activeRooms = (data || []).filter((r) => r.is_active !== false);
          setRooms(activeRooms);
          if (activeRooms.length > 0 && !formData.roomId) {
            setFormData((prev) => ({ ...prev, roomId: activeRooms[0]._id }));
          }
        })
        .catch((err) => console.error('Failed to load rooms:', err));
    }
  }, [isModalOpen, rooms.length, formData.roomId]);

  // Robust UTC parser ensuring ISO strings without Z are properly treated as UTC
  const parseIsoDate = (isoStr) => {
    if (!isoStr) return null;
    if (typeof isoStr === 'string' && !isoStr.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(isoStr)) {
      return new Date(`${isoStr}Z`);
    }
    return new Date(isoStr);
  };

  // Formatters
  const formatTimeRange = (startStr, endStr) => {
    if (!startStr || !endStr) return '';
    const s = parseIsoDate(startStr);
    const e = parseIsoDate(endStr);
    if (!s || !e) return '';
    const sTime = s.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const eTime = e.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `${sTime} – ${eTime}`;
  };

  const getStatusBadge = (booking) => {
    if (booking.status === 'cancelled') {
      return {
        label: 'Cancelled',
        className: 'bg-rose-50 text-rose-700 border-rose-200',
        dot: 'bg-rose-500',
      };
    }
    if (booking.status === 'cancellation_pending') {
      return {
        label: 'Cancel Pending Review',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500',
      };
    }
    const now = new Date();
    const start = parseIsoDate(booking.time_slot.start);
    const end = parseIsoDate(booking.time_slot.end);

    if (now >= start && now <= end) {
      return {
        label: 'In Progress Now',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold',
        dot: 'bg-emerald-500 animate-pulse',
      };
    }
    if (now < start) {
      return {
        label: 'Upcoming Today',
        className: 'bg-sky-50 text-sky-700 border-sky-200',
        dot: 'bg-sky-500',
      };
    }
    return {
      label: 'Completed',
      className: 'bg-slate-100 text-slate-600 border-slate-200',
      dot: 'bg-slate-400',
    };
  };

  // Handle new booking submission
  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    setBookingError(null);
    setBookingSuccess(null);

    if (!formData.roomId || !formData.title.trim()) {
      setBookingError('Please enter a meeting title and choose a room.');
      return;
    }

    try {
      setIsSubmitting(true);
      const startDateTime = new Date(`${formData.date}T${formData.startTime}:00`);
      const endDateTime = new Date(`${formData.date}T${formData.endTime}:00`);

      if (startDateTime >= endDateTime) {
        setBookingError('End time must be strictly after start time.');
        setIsSubmitting(false);
        return;
      }

      await bookingsApi.create({
        room_id: formData.roomId,
        title: formData.title.trim(),
        time_slot: {
          start: startDateTime.toISOString(),
          end: endDateTime.toISOString(),
        },
        attendees: [],
      });

      setBookingSuccess('Room booked successfully!');
      setFormData((prev) => ({ ...prev, title: '' }));
      setTimeout(() => {
        setIsModalOpen(false);
        setBookingSuccess(null);
        fetchTodayBookings(true);
      }, 900);
    } catch (err) {
      console.error('Failed to book room:', err);
      setBookingError(err.message || 'Failed to reserve room.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Role-aware cancel handler
  const handleCancelClick = (booking) => {
    if (isAdminOrSupervisor) {
      if (
        window.confirm(
          `As an Administrator, cancel booking "${booking.title}" in ${booking.room_name} immediately? This will notify all users.`
        )
      ) {
        const bookingId = booking.id || booking._id;
        bookingsApi
          .cancel(bookingId)
          .then(() => fetchTodayBookings(true))
          .catch((err) => alert(`Failed to cancel: ${err.message}`));
      }
    } else {
      // Staff workflow: open Cancellation Request modal
      setCancelModalBooking(booking);
      setCancelReason('');
      setCancelError(null);
    }
  };

  const handleCancellationRequestSubmit = async (e) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      setCancelError('Please provide a reason for the cancellation request.');
      return;
    }

    try {
      setIsCancelling(true);
      setCancelError(null);
      const bookingId = cancelModalBooking.id || cancelModalBooking._id;
      await bookingsApi.requestCancel(bookingId, cancelReason.trim());
      setCancelModalBooking(null);
      setCancelReason('');
      fetchTodayBookings(true);
      alert('Cancellation request submitted successfully! Administrators and supervisors have been notified by email to review.');
    } catch (err) {
      setCancelError(err.message || 'Failed to submit cancellation request.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Admin / Supervisor review handler (Approve or Reject cancellation request)
  const handleReviewSubmit = async (action) => {
    if (!reviewModalBooking) return;
    try {
      setIsReviewing(true);
      setReviewError(null);
      const bookingId = reviewModalBooking.id || reviewModalBooking._id;
      await bookingsApi.reviewCancel(bookingId, action, adminNotes.trim() || undefined);
      setReviewModalBooking(null);
      setAdminNotes('');
      fetchTodayBookings(true);
      alert(
        `Cancellation request ${
          action === 'approved'
            ? 'approved. The booking is cancelled and room has been freed.'
            : 'rejected. The booking remains confirmed.'
        }`
      );
    } catch (err) {
      setReviewError(err.message || `Failed to ${action} cancellation request.`);
    } finally {
      setIsReviewing(false);
    }
  };

  const todayFormatted = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Top Welcome Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#1977cc]/10 text-[#1977cc] text-xs font-semibold mb-3">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Logged in as {user?.email}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Welcome back, {user?.profile?.first_name || 'Member'}!
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Department: <span className="text-slate-800 capitalize font-medium">{user?.team || 'General'}</span> • Role: <span className="text-[#1977cc] font-medium capitalize">{user?.roles?.map((r) => r.role_name).join(', ') || 'Staff'}</span> • Type: <span className="text-emerald-700 font-medium capitalize">{user?.user_type || 'Full-Time'}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-[#1977cc] hover:bg-[#1565b0] text-white font-medium text-sm shadow-sm transition flex items-center space-x-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Book a Room</span>
          </button>
        </div>
      </div>

      {/* 2. PROMINENT BLOCK: ROOMS BOOKED FOR TODAY */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
        {/* Header of Today's Bookings Block */}
        <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-[#1977cc]/10 text-[#1977cc] rounded-xl flex-shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Rooms Booked for Today
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {todayBookings.length} {todayBookings.length === 1 ? 'Booking' : 'Bookings'}
                </span>
              </div>
              <p className="text-slate-500 text-sm mt-0.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{todayFormatted}</span>
              </p>
            </div>
          </div>

          {/* Action and Filter Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-xl border border-slate-200/80 cursor-pointer transition select-none">
              <input
                type="checkbox"
                checked={includeCancelled}
                onChange={(e) => setIncludeCancelled(e.target.checked)}
                className="rounded border-slate-300 text-[#1977cc] focus:ring-[#1977cc]"
              />
              <span>Show cancelled</span>
            </label>

            <button
              onClick={() => fetchTodayBookings(true)}
              disabled={isRefreshing}
              title="Refresh schedule"
              className="p-2 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#1977cc]' : ''}`} />
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-2 text-xs font-medium rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Reserve Room</span>
            </button>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6 sm:p-8">
          {isLoading ? (
            /* Loading skeletons */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((n) => (
                <div key={n} className="border border-slate-200/70 rounded-xl p-5 animate-pulse bg-slate-50/50 space-y-3">
                  <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                  <div className="h-5 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                  <div className="h-8 bg-slate-200 rounded w-full pt-2"></div>
                </div>
              ))}
            </div>
          ) : error ? (
            /* Error banner */
            <div className="p-5 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-3 text-rose-800 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          ) : todayBookings.length === 0 ? (
            /* Friendly Empty State */
            <div className="text-center py-12 px-4 max-w-md mx-auto">
              <div className="w-16 h-16 bg-blue-50 text-[#1977cc] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-sm">
                <Building className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No Rooms Booked for Today</h3>
              <p className="text-slate-500 text-sm mt-1.5 leading-relaxed">
                All meeting rooms and spaces are currently open and free for booking today ({todayFormatted}).
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-5 inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#1977cc] hover:bg-[#1565b0] text-white font-medium text-sm transition shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Book a Room for Today</span>
              </button>
            </div>
          ) : (
            /* Bookings Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {todayBookings.map((booking) => {
                const statusInfo = getStatusBadge(booking);
                const isCreator = user && (booking.created_by === user.id || booking.creator_email === user.email);

                return (
                  <div
                    key={booking.id}
                    className="border border-slate-200/90 rounded-xl p-5 hover:shadow-md hover:border-slate-300 transition bg-white flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top: Room badge & Status pill */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200/70">
                          <Building className="w-3.5 h-3.5 text-[#1977cc]" />
                          <span>{booking.room_name}</span>
                        </span>

                        <span className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusInfo.className}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`}></span>
                          <span>{statusInfo.label}</span>
                        </span>
                      </div>

                      {/* Meeting Title */}
                      <h4 className="text-base font-bold text-slate-900 tracking-tight group-hover:text-[#1977cc] transition mb-2">
                        {booking.title}
                      </h4>

                      {/* Date & Time Slot */}
                      <div className="flex items-center space-x-2 text-sm text-slate-600 mb-4 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200/60 font-medium">
                        <Clock className="w-4 h-4 text-[#1977cc] flex-shrink-0" />
                        <span>{formatTimeRange(booking.time_slot.start, booking.time_slot.end)}</span>
                      </div>
                    </div>

                    {/* Bottom: Booked By info */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">
                          {(booking.creator_name || booking.creator_email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-semibold text-slate-800 truncate">
                              {booking.creator_name || 'Staff Member'}
                            </p>
                            {isCreator && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#1977cc]/10 text-[#1977cc]">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">
                            {booking.creator_email || 'Organizer'}
                          </p>
                        </div>
                      </div>

                      {/* Cancel or Review Action */}
                      {booking.status === 'cancellation_pending' ? (
                        isAdminOrSupervisor ? (
                          <button
                            type="button"
                            onClick={() => {
                              setReviewModalBooking(booking);
                              setAdminNotes('');
                              setReviewError(null);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition cursor-pointer flex items-center space-x-1"
                          >
                            <span>Review Request</span>
                          </button>
                        ) : (
                          <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            Pending Review
                          </span>
                        )
                      ) : (
                        booking.status === 'confirmed' &&
                        new Date() < parseIsoDate(booking.time_slot?.end) && (
                          <button
                            type="button"
                            onClick={() => handleCancelClick(booking)}
                            title={
                              isAdminOrSupervisor
                                ? 'Cancel booking immediately (Admin/Supervisor)'
                                : 'Submit cancellation request to admin/supervisor'
                            }
                            className={`p-1.5 rounded-lg transition cursor-pointer flex items-center space-x-1 ${
                              isAdminOrSupervisor
                                ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                : 'text-slate-500 hover:text-amber-700 hover:bg-amber-50 bg-slate-50 border border-slate-200/80 px-2.5'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-500" />
                            {!isAdminOrSupervisor && (
                              <span className="text-[11px] font-medium text-slate-700">Request Cancel</span>
                            )}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. MODAL: BOOK A ROOM */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2.5 bg-[#1977cc]/10 text-[#1977cc] rounded-xl">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Book a Room</h3>
                <p className="text-slate-500 text-xs mt-0.5">Reserve a space with real-time schedule conflict prevention</p>
              </div>
            </div>

            {bookingError && (
              <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{bookingError}</span>
              </div>
            )}

            {bookingSuccess && (
              <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                <span>{bookingSuccess}</span>
              </div>
            )}

            <form onSubmit={handleBookingSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Room
                </label>
                <select
                  value={formData.roomId}
                  onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1977cc]/20 focus:border-[#1977cc] bg-white transition"
                >
                  {rooms.length === 0 ? (
                    <option value="">Loading active rooms...</option>
                  ) : (
                    rooms.map((room) => (
                      <option key={room._id} value={room._id}>
                        {room.name} {room.capacity ? `(Capacity: ${room.capacity})` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Meeting Title or Purpose
                </label>
                <input
                  type="text"
                  placeholder="e.g. Weekly Design Review"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1977cc]/20 focus:border-[#1977cc] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1977cc]/20 focus:border-[#1977cc] transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1977cc]/20 focus:border-[#1977cc] transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1977cc]/20 focus:border-[#1977cc] transition"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#1977cc] hover:bg-[#1565b0] text-white text-sm font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer flex items-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Checking & Booking...</span>
                    </>
                  ) : (
                    <span>Confirm Booking</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: REQUEST CANCELLATION (Staff Workflow) */}
      {cancelModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative">
            <button
              onClick={() => setCancelModalBooking(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-5">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-200">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Request Cancellation</h3>
                <p className="text-slate-500 text-xs mt-0.5">Staff requests require administrator approval</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl mb-4 text-xs space-y-1">
              <div className="text-slate-500">Meeting: <span className="font-semibold text-slate-800">{cancelModalBooking.title}</span></div>
              <div className="text-slate-500">Room: <span className="font-semibold text-slate-800">{cancelModalBooking.room_name}</span></div>
              <div className="text-slate-500">Time: <span className="font-semibold text-slate-800">{formatTimeRange(cancelModalBooking.time_slot.start, cancelModalBooking.time_slot.end)}</span></div>
            </div>

            {cancelError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{cancelError}</span>
              </div>
            )}

            <form onSubmit={handleCancellationRequestSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Reason for cancellation <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Session postponed due to scheduling conflict..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition resize-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  An email notification will be dispatched to admins and supervisors to review your request.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setCancelModalBooking(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium transition cursor-pointer"
                >
                  Keep Booking
                </button>
                <button
                  type="submit"
                  disabled={isCancelling}
                  className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
                >
                  {isCancelling ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting Request...</span>
                    </>
                  ) : (
                    <span>Submit Cancellation Request</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 4. MODAL: REVIEW CANCELLATION REQUEST (Admin/Supervisor) */}
      {reviewModalBooking && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Review Cancellation Request</h3>
                  <p className="text-slate-500 text-xs">Approve or reject staff cancellation request</p>
                </div>
              </div>
              <button
                onClick={() => setReviewModalBooking(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-xl text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Meeting:</span>
                <span className="font-semibold text-slate-800">{reviewModalBooking.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Room:</span>
                <span className="font-semibold text-slate-800">{reviewModalBooking.room_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Time:</span>
                <span className="font-semibold text-slate-800">
                  {formatTimeRange(reviewModalBooking.time_slot.start, reviewModalBooking.time_slot.end)}
                </span>
              </div>
              <div className="pt-2 border-t border-amber-200/60">
                <span className="text-slate-500 block mb-1 font-medium">Reason submitted by staff:</span>
                <p className="text-amber-950 font-medium bg-white p-2.5 rounded-lg border border-amber-200/60">
                  "{reviewModalBooking.cancellation_request?.reason || 'No reason provided'}"
                </p>
              </div>
            </div>

            {reviewError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{reviewError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Admin Decision Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional feedback for the staff member..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#1977cc]/20 focus:border-[#1977cc] transition resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  disabled={isReviewing}
                  onClick={() => handleReviewSubmit('rejected')}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  {isReviewing ? 'Processing...' : 'Reject Request (Keep Booking)'}
                </button>
                <button
                  type="button"
                  disabled={isReviewing}
                  onClick={() => handleReviewSubmit('approved')}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
                >
                  {isReviewing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>Approve & Cancel Booking</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleView;
