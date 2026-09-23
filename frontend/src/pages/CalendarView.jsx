import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { bookingsApi, roomsApi, getCached } from '../api';
import AttendeeSelector from '../components/AttendeeSelector';
import BookingDetailsModal from '../components/BookingDetailsModal';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Building,
  Users,
  Plus,
  RefreshCw,
  User as UserIcon,
  AlertCircle,
  CheckCircle2,
  X,
  XCircle,
  Filter,
  CalendarDays,
  Sparkles,
  Inbox,
  Pencil,
} from 'lucide-react';
import {
  HONG_KONG_TZ,
  createHKIsoString,
  formatHKTimeRange,
  formatHKDate,
  getHKDateKey,
  getHKTodayKey,
  getHKTime24,
  getHKCurrentTimeString,
  getHKDefaultStartEndTimes,
  isHKPast,
  parseIsoDate,
} from '../utils/timezone';

/**
 * Memoized Calendar Day Cell
 * Only re-renders if selection, today status, or bookings for this specific day change.
 */
const CalendarDayCell = React.memo(function CalendarDayCell({
  item,
  dayBookings,
  isSelected,
  isToday,
  onSelectDate,
}) {
  const bookingCount = dayBookings.length;
  const hasPending = dayBookings.some((b) => b.status === 'cancellation_pending');
  const allCancelled = bookingCount > 0 && dayBookings.every((b) => b.status?.toLowerCase() === 'cancelled');

  return (
    <button
      type="button"
      onClick={() => onSelectDate(item.date)}
      className={`min-h-[72px] sm:min-h-[82px] p-1.5 sm:p-2 rounded-xl text-left border transition flex flex-col justify-between cursor-pointer ${
        isSelected
          ? 'bg-[#1977cc] text-white border-[#1977cc] shadow-md ring-2 ring-[#1977cc]/20'
          : isToday
          ? 'bg-blue-50/60 text-[#1977cc] border-[#1977cc]/30 hover:border-[#1977cc]'
          : item.isCurrentMonth
          ? 'bg-white text-slate-800 border-slate-100 hover:border-slate-300 hover:bg-slate-50/70'
          : 'bg-slate-50/50 text-slate-400 border-transparent hover:bg-slate-100/50'
      }`}
    >
      <div className="flex items-center justify-between w-full">
        <span
          className={`text-xs font-bold leading-none ${
            isSelected
              ? 'text-white'
              : isToday
              ? 'text-[#1977cc]'
              : item.isCurrentMonth
              ? 'text-slate-800'
              : 'text-slate-400'
          }`}
        >
          {item.date.getDate()}
        </span>
        {isToday && !isSelected && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#1977cc]" title="Today" />
        )}
      </div>

      {bookingCount > 0 ? (
        <div className="w-full mt-1">
          <div
            className={`text-[10px] sm:text-[11px] font-semibold px-1.5 py-0.5 rounded-md text-center truncate ${
              isSelected
                ? 'bg-white/20 text-white'
                : allCancelled
                ? 'bg-rose-100 text-rose-700'
                : hasPending
                ? 'bg-amber-100 text-amber-800'
                : dayBookings.every((b) => {
                    const end = parseIsoDate(b.time_slot?.end);
                    return end && new Date() > end;
                  })
                ? 'bg-slate-100 text-slate-600'
                : 'bg-blue-100 text-[#1977cc]'
            }`}
          >
            {bookingCount} {allCancelled ? 'cancelled' : bookingCount === 1 ? 'booking' : 'bookings'}
          </div>
        </div>
      ) : (
        <div className="h-4" />
      )}
    </button>
  );
});

export const CalendarView = () => {
  const { user } = useAuth();

  // Current view date (month being browsed) and currently selected date
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  // Bookings and rooms data
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [myBookingsOnly, setMyBookingsOnly] = useState(false);
  const [includeCancelled, setIncludeCancelled] = useState(false);

  // Role detection
  const isAdminOrSupervisor = user?.roles?.some((r) =>
    ['admin', 'supervisor'].includes(r.role_name?.toLowerCase())
  );

  // Modal State for Booking
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalFormData, setModalFormData] = useState(() => {
    const upcoming = getHKDefaultStartEndTimes();
    return {
      roomId: '',
      title: '',
      date: getHKTodayKey(),
      startTime: upcoming.startTime,
      endTime: upcoming.endTime,
      attendees: [],
    };
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  // Edit / Reschedule Modal State
  const [editModalBooking, setEditModalBooking] = useState(null);
  const [editFormData, setEditFormData] = useState({
    roomId: '',
    title: '',
    date: getHKTodayKey(),
    startTime: '',
    endTime: '',
    attendees: [],
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState(null);
  const [editSuccess, setEditSuccess] = useState(null);

  // Cancellation Modal State (Staff Request)
  const [cancelModalBooking, setCancelModalBooking] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  // Admin Review Modal State
  const [reviewModalBooking, setReviewModalBooking] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  // State for Booking Details Popover Modal
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState(null);

  // Helper: robust date to YYYY-MM-DD in Hong Kong timezone
  const toDateKey = (date) => {
    return getHKDateKey(date);
  };

  // Load Rooms list once
  useEffect(() => {
    roomsApi.list()
      .then((data) => {
        const activeRooms = (data || []).filter((r) => r.is_active !== false);
        setRooms(activeRooms);
      })
      .catch((err) => console.error('Failed to load rooms:', err));
  }, []);

  // Fetch month bookings
  const fetchMonthBookings = useCallback(async (showRefreshing = false) => {
    // Calculate date range for current month plus padding
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // First day of month at 00:00:00
    const startOfMonth = new Date(year, month, 1, 0, 0, 0);
    // Last day of month at 23:59:59
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

    // Expand to start of week (Sunday) and end of week (Saturday)
    const startDate = new Date(startOfMonth);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(endOfMonth);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
    endDate.setHours(23, 59, 59, 999);

    const params = {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    };
    if (selectedRoomId) params.room_id = selectedRoomId;
    if (myBookingsOnly) params.my_bookings = true;

    // Check RAM cache first for 0ms instant display in the 42 boxes
    const cacheKey = `bookings_list_${new URLSearchParams(params).toString()}`;
    const cached = getCached(cacheKey);

    if (cached) {
      setBookings(cached);
      setIsLoading(false);
      if (showRefreshing) setIsRefreshing(true);
    } else {
      if (showRefreshing) setIsRefreshing(true);
      else setIsLoading(true);
    }
    setError(null);

    try {
      // Background revalidation / fetch
      const data = await bookingsApi.list(params, !showRefreshing);
      setBookings(data || []);
    } catch (err) {
      if (!cached) {
        console.error('Failed to fetch calendar bookings:', err);
        setError(err.message || 'Unable to load bookings for this period.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentMonth, selectedRoomId, myBookingsOnly]);

  useEffect(() => {
    fetchMonthBookings();
  }, [fetchMonthBookings]);

  // Filter bookings: when includeCancelled is checked, strictly show ONLY cancelled bookings
  const displayedBookings = useMemo(() => {
    if (includeCancelled) {
      return bookings.filter((b) => b.status?.toLowerCase() === 'cancelled');
    }
    return bookings.filter((b) => b.status?.toLowerCase() !== 'cancelled');
  }, [bookings, includeCancelled]);

  // Index bookings by date key "YYYY-MM-DD"
  const bookingsByDate = useMemo(() => {
    const map = {};
    displayedBookings.forEach((booking) => {
      const start = parseIsoDate(booking.time_slot?.start);
      if (start) {
        const key = toDateKey(start);
        if (!map[key]) map[key] = [];
        map[key].push(booking);
      }
    });
    return map;
  }, [displayedBookings]);

  // Calendar grid construction
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const days = [];

    // Leading days from previous month
    const startDayOfWeek = firstDayOfMonth.getDay();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false });
    }

    // Days of current month
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true });
    }

    // Trailing days from next month to fill 42 cells (6 rows of 7)
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false });
    }

    return days;
  }, [currentMonth]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(now);
  };

  const handleSelectDate = useCallback((date) => {
    setSelectedDate(date);
  }, []);

  // Selected date bookings list
  const selectedDateKey = toDateKey(selectedDate);
  const selectedDateBookings = useMemo(() => {
    const dayBookings = bookingsByDate[selectedDateKey] || [];
    return [...dayBookings].sort((a, b) => {
      const aStart = parseIsoDate(a.time_slot?.start);
      const bStart = parseIsoDate(b.time_slot?.start);
      return (aStart?.getTime() || 0) - (bStart?.getTime() || 0);
    });
  }, [bookingsByDate, selectedDateKey]);

  // Formatters
  const formatTimeSlot = (timeSlot) => {
    if (!timeSlot?.start || !timeSlot?.end) return 'TBD';
    return formatHKTimeRange(timeSlot.start, timeSlot.end);
  };

  const isToday = (date) => {
    return toDateKey(date) === getHKTodayKey();
  };

  const isSelected = (date) => {
    return toDateKey(date) === selectedDateKey;
  };

  // Open booking modal prefilled with selected date (ensuring it's not in the past)
  const openBookingModalForDate = (dateToBook = selectedDate) => {
    const rawKey = toDateKey(dateToBook);
    const todayKey = getHKTodayKey();
    const effectiveDate = rawKey < todayKey ? todayKey : rawKey;
    const upcoming = getHKDefaultStartEndTimes();

    setModalFormData({
      roomId: rooms[0]?._id || '',
      title: '',
      date: effectiveDate,
      startTime: upcoming.startTime,
      endTime: upcoming.endTime,
      attendees: [],
    });
    setBookingError(null);
    setBookingSuccess(null);
    setIsModalOpen(true);
  };

  // Handle new booking submit
  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    setBookingError(null);
    setBookingSuccess(null);

    if (!modalFormData.roomId || !modalFormData.title.trim()) {
      setBookingError('Please enter a meeting title and choose a room.');
      return;
    }

    try {
      setIsSubmitting(true);
      const startIso = createHKIsoString(modalFormData.date, modalFormData.startTime);
      const endIso = createHKIsoString(modalFormData.date, modalFormData.endTime);

      if (new Date(startIso) >= new Date(endIso)) {
        setBookingError('End time must be strictly after start time.');
        setIsSubmitting(false);
        return;
      }

      if (isHKPast(modalFormData.date, modalFormData.startTime)) {
        setBookingError('Please select an upcoming time slot.');
        setIsSubmitting(false);
        return;
      }

      await bookingsApi.create({
        room_id: modalFormData.roomId,
        title: modalFormData.title.trim(),
        time_slot: {
          start: startIso,
          end: endIso,
        },
        attendees: (modalFormData.attendees || []).map((att) => ({
          user_id: att.user_id,
          role: att.role || 'attendee',
        })),
      });

      setBookingSuccess('Room booked successfully!');
      window.dispatchEvent(new CustomEvent('booking-updated'));
      setTimeout(() => {
        setIsModalOpen(false);
        setBookingSuccess(null);
        fetchMonthBookings(true);
      }, 800);
    } catch (err) {
      console.error('Failed to book room:', err);
      setBookingError(err.message || 'Failed to reserve room.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancellation handler
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
          .then(() => {
            window.dispatchEvent(new CustomEvent('booking-updated'));
            fetchMonthBookings(true);
          })
          .catch((err) => alert(`Failed to cancel: ${err.message}`));
      }
    } else {
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
      window.dispatchEvent(new CustomEvent('booking-updated'));
      fetchMonthBookings(true);
      alert('Cancellation request submitted successfully! Administrators have been notified to review.');
    } catch (err) {
      setCancelError(err.message || 'Failed to submit cancellation request.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReviewSubmit = async (action) => {
    if (!reviewModalBooking) return;
    try {
      setIsReviewing(true);
      setReviewError(null);
      const bookingId = reviewModalBooking.id || reviewModalBooking._id;
      await bookingsApi.reviewCancel(bookingId, action, adminNotes.trim() || undefined);
      setReviewModalBooking(null);
      setAdminNotes('');
      window.dispatchEvent(new CustomEvent('booking-updated'));
      fetchMonthBookings(true);
    } catch (err) {
      setReviewError(err.message || `Failed to ${action} request`);
    } finally {
      setIsReviewing(false);
    }
  };

  // Open Edit / Reschedule Modal
  const handleOpenEditModal = (booking) => {
    const startIso = booking.time_slot?.start;
    const endIso = booking.time_slot?.end;
    const dateKey = startIso ? getHKDateKey(startIso) : getHKTodayKey();
    const startTime = startIso ? getHKTime24(startIso) : '09:00';
    const endTime = endIso ? getHKTime24(endIso) : '10:00';

    setEditModalBooking(booking);
    setEditFormData({
      roomId: booking.room_id || (rooms.length > 0 ? rooms[0]._id : ''),
      title: booking.title || '',
      date: dateKey,
      startTime: startTime,
      endTime: endTime,
      attendees: Array.isArray(booking.attendees) ? [...booking.attendees] : [],
    });
    setEditError(null);
    setEditSuccess(null);
  };

  // Submit Edit / Reschedule
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError(null);
    setEditSuccess(null);

    if (!editModalBooking) return;
    if (!editFormData.roomId || !editFormData.title.trim()) {
      setEditError('Please enter a meeting title and choose a room.');
      return;
    }

    try {
      setIsUpdating(true);
      const startIso = createHKIsoString(editFormData.date, editFormData.startTime);
      const endIso = createHKIsoString(editFormData.date, editFormData.endTime);

      if (new Date(startIso) >= new Date(endIso)) {
        setEditError('End time must be strictly after start time.');
        setIsUpdating(false);
        return;
      }

      if (isHKPast(editFormData.date, editFormData.startTime)) {
        setEditError('Please select an upcoming time slot.');
        setIsUpdating(false);
        return;
      }

      const bookingId = editModalBooking.id || editModalBooking._id;
      await bookingsApi.update(bookingId, {
        room_id: editFormData.roomId,
        title: editFormData.title.trim(),
        time_slot: {
          start: startIso,
          end: endIso,
        },
        attendees: (editFormData.attendees || []).map((att) => ({
          user_id: att.user_id,
          role: att.role || 'attendee',
        })),
      });

      setEditSuccess('Booking updated successfully!');
      window.dispatchEvent(new CustomEvent('booking-updated'));
      setTimeout(() => {
        setEditModalBooking(null);
        setEditSuccess(null);
        fetchMonthBookings(true);
      }, 900);
    } catch (err) {
      console.error('Failed to update booking:', err);
      setEditError(err.message || 'Failed to update booking.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Determine status and display styling for a booking (Completed, In Progress, Confirmed, Pending, Cancelled)
  const getBookingStatus = (booking) => {
    if (booking.status === 'cancelled') {
      return {
        label: 'Cancelled',
        badgeClass: 'bg-rose-100 text-rose-700 border-rose-200',
        dotClass: 'bg-rose-500',
        cardClass: 'bg-rose-50/30 border-rose-200 opacity-70',
        isCancelled: true,
        isCompleted: false,
      };
    }
    if (booking.status === 'cancellation_pending') {
      return {
        label: 'Cancel Pending',
        badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
        dotClass: 'bg-amber-500',
        cardClass: 'bg-amber-50/30 border-amber-200',
        isCancelled: false,
        isCompleted: false,
      };
    }

    const now = new Date();
    const start = parseIsoDate(booking.time_slot?.start);
    const end = parseIsoDate(booking.time_slot?.end);

    // If meeting end time is strictly in the past: Completed
    if (end && now > end) {
      return {
        label: 'Completed',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-300',
        dotClass: 'bg-slate-400',
        cardClass: 'bg-slate-50/70 border-slate-200/90 opacity-80',
        isCancelled: false,
        isCompleted: true,
      };
    }

    // If currently occurring: In Progress
    if (start && end && now >= start && now <= end) {
      return {
        label: 'In Progress Now',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold',
        dotClass: 'bg-emerald-500 animate-pulse',
        cardClass: 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-400/20',
        isCancelled: false,
        isCompleted: false,
      };
    }

    // Default upcoming confirmed meeting
    return {
      label: 'Confirmed',
      badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
      dotClass: 'bg-blue-500',
      cardClass: 'bg-white border-slate-200/90 hover:border-slate-300 shadow-xs',
      isCancelled: false,
      isCompleted: false,
    };
  };

  const formattedMonthName = new Intl.DateTimeFormat('en-US', {
    timeZone: HONG_KONG_TZ,
    month: 'long',
    year: 'numeric',
  }).format(currentMonth);

  const formattedSelectedDate = formatHKDate(selectedDate);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#1977cc]/10 text-[#1977cc] text-xs font-semibold mb-3">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Room Reservation Calendar</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Calendar View Bookings
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Browse schedule by month and date, view room occupation, and reserve available slots.
          </p>
        </div>
      </div>

      {/* Filter & Control Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Room Filter */}
          <div className="flex items-center space-x-2">
            <Building className="w-4 h-4 text-slate-400" />
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="py-2 pl-3 pr-8 rounded-xl border border-slate-300 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:border-[#1977cc] focus:ring-2 focus:ring-[#1977cc]/20"
            >
              <option value="">All Rooms ({rooms.length})</option>
              {rooms.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* My Bookings Toggle */}
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 cursor-pointer transition select-none">
            <input
              type="checkbox"
              checked={myBookingsOnly}
              onChange={(e) => setMyBookingsOnly(e.target.checked)}
              className="rounded border-slate-300 text-[#1977cc] focus:ring-[#1977cc]"
            />
            <span>My Bookings Only</span>
          </label>

          {/* Show Cancelled Toggle */}
          <label className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border cursor-pointer transition select-none ${
            includeCancelled
              ? 'bg-rose-50 border-rose-200 text-rose-700 font-semibold shadow-xs'
              : 'text-slate-600 bg-slate-50 hover:bg-slate-100 border-slate-200'
          }`}>
            <input
              type="checkbox"
              checked={includeCancelled}
              onChange={(e) => setIncludeCancelled(e.target.checked)}
              className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
            />
            <span>Show Cancelled Only</span>
          </label>
        </div>

        <div className="flex items-center space-x-2 self-end lg:self-auto">
          <button
            onClick={handleToday}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          >
            Today
          </button>
          <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
            <button
              onClick={handlePrevMonth}
              title="Previous Month"
              className="p-2 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-bold text-slate-800 min-w-[130px] text-center">
              {formattedMonthName}
            </span>
            <button
              onClick={handleNextMonth}
              title="Next Month"
              className="p-2 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => fetchMonthBookings(true)}
            disabled={isRefreshing}
            title="Refresh Bookings"
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#1977cc]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content Layout: Calendar Grid + Selected Day Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Interactive Month Calendar (7 columns on desktop) */}
        <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-[#1977cc]" />
              <span>{formattedMonthName}</span>
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Click any date to view scheduled bookings
            </span>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Day Cells */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((item) => {
              const dayKey = toDateKey(item.date);
              return (
                <CalendarDayCell
                  key={dayKey}
                  item={item}
                  dayBookings={bookingsByDate[dayKey] || []}
                  isSelected={isSelected(item.date)}
                  isToday={isToday(item.date)}
                  onSelectDate={handleSelectDate}
                />
              );
            })}
          </div>

          {/* Calendar Legend */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
            <div className="flex items-center space-x-4 flex-wrap gap-y-1">
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1977cc]" />
                <span>Selected</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span>Upcoming</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                <span>Completed</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>Cancellation Pending</span>
              </span>
            </div>
            <span>Total period bookings: {bookings.length}</span>
          </div>
        </div>

        {/* Right Column: Selected Date Schedule Details (5 columns on desktop) */}
        <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#1977cc]">
                Day Schedule
              </p>
              <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                {formattedSelectedDate}
              </h2>
            </div>
            {selectedDateKey < getHKTodayKey() ? (
              <span
                className="p-2 rounded-xl bg-slate-100 text-slate-400 cursor-not-allowed"
                title="Cannot book for dates in the past"
              >
                <Plus className="w-4 h-4" />
              </span>
            ) : (
              <button
                onClick={() => openBookingModalForDate(selectedDate)}
                className="p-2 rounded-xl bg-[#1977cc]/10 text-[#1977cc] hover:bg-[#1977cc] hover:text-white transition cursor-pointer"
                title="Book Room on this Date"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Bookings for the selected day */}
          {isLoading ? (
            <div className="space-y-3 py-6">
              {[1, 2].map((n) => (
                <div key={n} className="p-4 rounded-xl border border-slate-200/70 bg-slate-50/50 animate-pulse space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="h-4 bg-slate-200 rounded w-2/3" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : selectedDateBookings.length === 0 ? (
            <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Inbox className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                {includeCancelled ? 'No Cancelled Bookings for this Date' : 'No Bookings for this Date'}
              </p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                {includeCancelled
                  ? 'There are no cancelled reservations recorded for this date.'
                  : 'All rooms are currently vacant and available on this day.'}
              </p>
              {!includeCancelled && (
                selectedDateKey < getHKTodayKey() ? (
                  <div className="mt-2 py-2 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 font-medium inline-block">
                    Past Date • Reservations cannot be made for past dates
                  </div>
                ) : (
                  <button
                    onClick={() => openBookingModalForDate(selectedDate)}
                    className="mt-2 inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#1977cc] hover:bg-[#1565b0] text-white text-xs font-semibold shadow-sm transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Reserve a Room</span>
                  </button>
                )
              )}
            </div>
          ) : (
            <div className="space-y-4 max-h-[580px] overflow-y-auto pr-1">
              {selectedDateBookings.map((booking) => {
                const isOwner = user?.id === booking.created_by;
                const statusMeta = getBookingStatus(booking);

                return (
                  <div
                    key={booking.id}
                    onClick={() => setSelectedBookingForDetails(booking)}
                    className={`p-4 rounded-xl border transition cursor-pointer hover:shadow-lg hover:border-[#1977cc]/60 hover:bg-slate-50/40 relative ${statusMeta.cardClass}`}
                    title="Click to view full booking details & room amenities"
                  >
                    {/* Header: Room Name & Status */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="p-1.5 rounded-lg bg-[#1977cc]/10 text-[#1977cc]">
                          <Building className="w-4 h-4" />
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                          {booking.room_name}
                        </span>
                      </div>
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize inline-flex items-center space-x-1.5 border ${statusMeta.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                        <span>{statusMeta.label}</span>
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-base font-semibold text-slate-800 mb-2">
                      {booking.title}
                    </h3>

                    {/* Meta information */}
                    <div className="space-y-1.5 text-xs text-slate-500 mb-3">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatTimeSlot(booking.time_slot)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {booking.creator_name || 'Organizer'}
                          {booking.creator_email ? ` (${booking.creator_email})` : ''}
                        </span>
                      </div>

                      {/* Attendees preview */}
                      {Array.isArray(booking.attendees) && booking.attendees.length > 0 && (
                        <div className="flex items-center space-x-2 text-xs text-slate-600 bg-blue-50/50 px-2.5 py-1.5 rounded-lg border border-blue-100/70 mt-1.5">
                          <Users className="w-3.5 h-3.5 text-[#1977cc] shrink-0" />
                          <span className="font-semibold text-slate-700">
                            {booking.attendees.length} Attendee{booking.attendees.length === 1 ? '' : 's'}:
                          </span>
                          <span className="truncate text-slate-600 text-[11px]">
                            {booking.attendees.map((a) => a.name || a.email || 'Colleague').join(', ')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Cancellation or Admin Review action */}
                    {!statusMeta.isCancelled && !statusMeta.isCompleted && (
                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                        {booking.status === 'cancellation_pending' ? (
                          isAdminOrSupervisor ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReviewModalBooking(booking);
                                setAdminNotes('');
                                setReviewError(null);
                              }}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition cursor-pointer flex items-center space-x-1"
                            >
                              <span>Review Request</span>
                            </button>
                          ) : (
                            <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              Pending Admin Review
                            </span>
                          )
                        ) : (
                          booking.status === 'confirmed' && (
                            <div className="flex items-center space-x-2 ml-auto">
                              {(isOwner || isAdminOrSupervisor) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditModal(booking);
                                  }}
                                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer flex items-center space-x-1"
                                  title="Edit or Reschedule this booking"
                                >
                                  <Pencil className="w-3.5 h-3.5 text-[#1977cc]" />
                                  <span>Edit</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelClick(booking);
                                }}
                                className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition cursor-pointer flex items-center space-x-1 ${isAdminOrSupervisor
                                    ? 'text-rose-600 hover:bg-rose-50'
                                    : 'text-amber-700 hover:bg-amber-50'
                                  }`}
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>
                                  {isAdminOrSupervisor ? 'Cancel' : 'Request Cancel'}
                                </span>
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Booking Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-[#1977cc]/10 text-[#1977cc]">
                  <Plus className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Reserve a Room</h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {bookingError && (
              <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-2.5 text-red-700 text-xs font-medium">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{bookingError}</span>
              </div>
            )}

            {bookingSuccess && (
              <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start space-x-2.5 text-emerald-700 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{bookingSuccess}</span>
              </div>
            )}

            <form onSubmit={handleBookingSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Room
                </label>
                <select
                  required
                  value={modalFormData.roomId}
                  onChange={(e) => setModalFormData({ ...modalFormData, roomId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:border-[#1977cc] focus:ring-2 focus:ring-[#1977cc]/20"
                >
                  {rooms.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Event / Meeting Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Youth Counseling Session"
                  value={modalFormData.title}
                  onChange={(e) => setModalFormData({ ...modalFormData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#1977cc] focus:ring-2 focus:ring-[#1977cc]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Reservation Date
                </label>
                <input
                  type="date"
                  required
                  min={getHKTodayKey()}
                  value={modalFormData.date}
                  onChange={(e) => setModalFormData({ ...modalFormData, date: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#1977cc] focus:ring-2 focus:ring-[#1977cc]/20"
                />
              </div>

              {(() => {
                const isTodaySelected = modalFormData.date === getHKTodayKey();
                const isPastSelected = isHKPast(modalFormData.date, modalFormData.startTime);
                const isInvalidTimeOrder =
                  Boolean(modalFormData.startTime && modalFormData.endTime && modalFormData.startTime >= modalFormData.endTime);
                const hkCurrentTime = getHKCurrentTimeString();

                return (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                          Start Time
                        </label>
                        <input
                          type="time"
                          required
                          min={isTodaySelected ? hkCurrentTime : undefined}
                          value={modalFormData.startTime}
                          onChange={(e) => setModalFormData({ ...modalFormData, startTime: e.target.value })}
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-900 focus:outline-none focus:ring-2 transition ${isPastSelected
                              ? 'border-rose-300 bg-rose-50/40 text-rose-900 focus:ring-rose-200 focus:border-rose-400'
                              : 'border-slate-300 focus:border-[#1977cc] focus:ring-[#1977cc]/20'
                            }`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                          End Time
                        </label>
                        <input
                          type="time"
                          required
                          min={modalFormData.startTime || (isTodaySelected ? hkCurrentTime : undefined)}
                          value={modalFormData.endTime}
                          onChange={(e) => setModalFormData({ ...modalFormData, endTime: e.target.value })}
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-900 focus:outline-none focus:ring-2 transition ${isInvalidTimeOrder
                              ? 'border-rose-300 bg-rose-50/40 text-rose-900 focus:ring-rose-200 focus:border-rose-400'
                              : 'border-slate-300 focus:border-[#1977cc] focus:ring-[#1977cc]/20'
                            }`}
                        />
                      </div>
                    </div>

                    {isPastSelected && (
                      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                        <span>Please select an upcoming time slot.</span>
                      </div>
                    )}

                    {isInvalidTimeOrder && !isPastSelected && (
                      <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center space-x-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                        <span>End time must be strictly after start time.</span>
                      </div>
                    )}

                    {/* Attendee Selection */}
                    <div className="pt-2 border-t border-slate-100">
                      <AttendeeSelector
                        value={modalFormData.attendees}
                        onChange={(newAttendees) =>
                          setModalFormData({ ...modalFormData, attendees: newAttendees })
                        }
                        roomCapacity={rooms.find((r) => (r._id || r.id) === modalFormData.roomId)?.capacity}
                        organizerId={user?.id || user?._id}
                        organizerName={
                          user?.profile
                            ? `${user.profile.first_name || ''} ${user.profile.last_name || ''}`.trim() || user.email
                            : user?.email
                        }
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="pt-4 flex items-center justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting || isPastSelected || isInvalidTimeOrder}
                        className="px-5 py-2.5 rounded-xl bg-[#1977cc] hover:bg-[#1565b0] text-white font-medium text-sm shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {isSubmitting ? 'Reserving...' : 'Confirm Reservation'}
                      </button>
                    </div>
                  </>
                );
              })()}
            </form>
          </div>
        </div>
      )}

      {/* Edit / Reschedule Modal */}
      {editModalBooking && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-[#1977cc]/10 text-[#1977cc]">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Edit / Reschedule Booking</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Modify room, title, date, or time slot with conflict checks</p>
                </div>
              </div>
              <button
                onClick={() => setEditModalBooking(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-2.5 text-red-700 text-xs font-medium">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            {editSuccess && (
              <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start space-x-2.5 text-emerald-700 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{editSuccess}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              {/* Room selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Room
                </label>
                <select
                  value={editFormData.roomId}
                  onChange={(e) => setEditFormData({ ...editFormData, roomId: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#1977cc] focus:ring-2 focus:ring-[#1977cc]/20 bg-white"
                >
                  {rooms.length === 0 ? (
                    <option value={editFormData.roomId || ''}>
                      {editModalBooking.room_name || 'Current Room'}
                    </option>
                  ) : (
                    rooms.map((room) => (
                      <option key={room._id} value={room._id}>
                        {room.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Meeting Title or Purpose
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quarterly Team Sync"
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#1977cc] focus:ring-2 focus:ring-[#1977cc]/20"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  required
                  min={getHKTodayKey()}
                  value={editFormData.date}
                  onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#1977cc] focus:ring-2 focus:ring-[#1977cc]/20"
                />
              </div>

              {(() => {
                const isTodaySelected = editFormData.date === getHKTodayKey();
                const isPastSelected = isHKPast(editFormData.date, editFormData.startTime);
                const isInvalidTimeOrder =
                  Boolean(editFormData.startTime && editFormData.endTime && editFormData.startTime >= editFormData.endTime);
                const hkCurrentTime = getHKCurrentTimeString();

                return (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Start Time
                        </label>
                        <input
                          type="time"
                          required
                          min={isTodaySelected ? hkCurrentTime : undefined}
                          value={editFormData.startTime}
                          onChange={(e) => setEditFormData({ ...editFormData, startTime: e.target.value })}
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 transition ${isPastSelected
                              ? 'border-rose-300 bg-rose-50/40 text-rose-900 focus:ring-rose-200 focus:border-rose-400'
                              : 'border-slate-300 focus:ring-[#1977cc]/20 focus:border-[#1977cc]'
                            }`}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          End Time
                        </label>
                        <input
                          type="time"
                          required
                          min={editFormData.startTime || (isTodaySelected ? hkCurrentTime : undefined)}
                          value={editFormData.endTime}
                          onChange={(e) => setEditFormData({ ...editFormData, endTime: e.target.value })}
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 transition ${isInvalidTimeOrder
                              ? 'border-rose-300 bg-rose-50/40 text-rose-900 focus:ring-rose-200 focus:border-rose-400'
                              : 'border-slate-300 focus:ring-[#1977cc]/20 focus:border-[#1977cc]'
                            }`}
                        />
                      </div>
                    </div>

                    {isPastSelected && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-2 text-red-700 text-xs font-medium">
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <span>Please select an upcoming time slot.</span>
                      </div>
                    )}

                    {isInvalidTimeOrder && !isPastSelected && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start space-x-2 text-amber-700 text-xs font-medium">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <span>End time must be strictly after start time.</span>
                      </div>
                    )}

                    {/* Attendee Selection for Edit Modal */}
                    <div className="pt-2 border-t border-slate-100">
                      <AttendeeSelector
                        value={editFormData.attendees}
                        onChange={(newAttendees) =>
                          setEditFormData({ ...editFormData, attendees: newAttendees })
                        }
                        roomCapacity={rooms.find((r) => (r._id || r.id) === editFormData.roomId)?.capacity}
                        organizerId={editModalBooking?.created_by}
                        organizerName={
                          editModalBooking?.creator_name || editModalBooking?.creator_email || 'Organizer'
                        }
                        disabled={isUpdating}
                      />
                    </div>

                    <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setEditModalBooking(null)}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-sm transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isUpdating || isPastSelected || isInvalidTimeOrder}
                        className="px-5 py-2.5 rounded-xl bg-[#1977cc] hover:bg-[#1565b0] text-white font-medium text-sm shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center space-x-2"
                      >
                        {isUpdating ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Updating Booking...</span>
                          </>
                        ) : (
                          <span>Save Changes</span>
                        )}
                      </button>
                    </div>
                  </>
                );
              })()}
            </form>
          </div>
        </div>
      )}

      {/* Cancellation Request Modal (Staff) */}
      {cancelModalBooking && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-lg font-bold text-slate-900">Request Cancellation</h2>
              <button
                onClick={() => setCancelModalBooking(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Booking: <strong className="text-slate-800">{cancelModalBooking.title}</strong> in{' '}
              <strong className="text-slate-800">{cancelModalBooking.room_name}</strong>.
            </p>

            {cancelError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-xs font-medium">
                {cancelError}
              </div>
            )}

            <form onSubmit={handleCancellationRequestSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Reason for Cancellation
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Participant requested date change or meeting cancelled..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#1977cc] focus:ring-2 focus:ring-[#1977cc]/20"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelModalBooking(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isCancelling}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {isCancelling ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Cancellation Request Modal (Admin / Supervisor) */}
      {reviewModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2 text-amber-600">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <h3 className="text-base font-bold text-slate-900">Review Cancellation Request</h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewModalBooking(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-xs space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Booking:</span>
                <span className="font-semibold text-slate-800">{reviewModalBooking.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Room:</span>
                <span className="font-semibold text-slate-800">{reviewModalBooking.room_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Time:</span>
                <span className="font-semibold text-slate-800">
                  {formatTimeSlot(reviewModalBooking.time_slot)}
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
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2 mb-4">
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

      {/* 4. MODAL: BOOKING DETAILS POPUP */}
      {selectedBookingForDetails && (
        <BookingDetailsModal
          booking={selectedBookingForDetails}
          rooms={rooms}
          currentUserId={user?.id || user?._id}
          currentUserEmail={user?.email}
          isAdminOrSupervisor={isAdminOrSupervisor}
          onClose={() => setSelectedBookingForDetails(null)}
          onEdit={(b) => handleOpenEditModal(b)}
          onCancel={(b) => handleCancelClick(b)}
          onReview={(b) => {
            setReviewModalBooking(b);
            setAdminNotes('');
            setReviewError(null);
          }}
        />
      )}
    </div>
  );
};

export default CalendarView;
