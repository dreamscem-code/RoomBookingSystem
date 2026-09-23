import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { issuesApi, roomsApi, usersApi } from '../api';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Search,
  Building,
  User,
  X,
  Sparkles,
  Tv,
  Armchair,
  Thermometer,
  HelpCircle,
  Check,
} from 'lucide-react';
import { formatHKDateTime } from '../utils/timezone';

const CATEGORIES = [
  {
    id: 'cleanliness',
    label: 'Cleanliness',
    icon: Sparkles,
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    description: 'Spills, trash, or sanitation needs',
  },
  {
    id: 'av_equipment',
    label: 'AV Equipment',
    icon: Tv,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    description: 'Projectors, microphones, monitors, or audio issues',
  },
  {
    id: 'furniture',
    label: 'Furniture',
    icon: Armchair,
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    description: 'Broken chairs, tables, or whiteboard damage',
  },
  {
    id: 'temperature',
    label: 'Temperature',
    icon: Thermometer,
    color: 'bg-rose-100 text-rose-800 border-rose-200',
    description: 'AC, heating, or ventilation control',
  },
  {
    id: 'other',
    label: 'Other',
    icon: HelpCircle,
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    description: 'Lighting, doors, power sockets, or misc requests',
  },
];

export const ReportIssues = () => {
  const { user } = useAuth();

  // Main state
  const [issues, setIssues] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Report New Issue Modal
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportFormData, setReportFormData] = useState({
    roomId: '',
    category: 'cleanliness',
    description: '',
  });
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportError, setReportError] = useState(null);

  // Action loading state for individual issues
  const [updatingIssueId, setUpdatingIssueId] = useState(null);

  // Fetch initial data
  const loadData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const [issuesData, roomsData, usersData] = await Promise.all([
        issuesApi.listAll(),
        roomsApi.list(),
        usersApi.list().catch(() => []),
      ]);

      setIssues(issuesData || []);
      setRooms(roomsData || []);
      setUsers(usersData || []);
    } catch (err) {
      console.error('Failed to load issue reports:', err);
      setError(err.message || 'Unable to load room issue reports.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Helpers to resolve room and user names
  const getRoom = useCallback(
    (roomId) => rooms.find((r) => (r._id || r.id) === roomId),
    [rooms]
  );

  const getUser = useCallback(
    (userId) => users.find((u) => (u._id || u.id) === userId),
    [users]
  );

  // Filtered issues list: exclude resolved and dismissed issues so resolved items are removed
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      // Exclude resolved and dismissed issues
      if (issue.status === 'resolved' || issue.status === 'dismissed') {
        return false;
      }

      // Category filter
      if (categoryFilter !== 'all' && issue.category !== categoryFilter) return false;

      // Room filter
      if (roomFilter !== 'all' && issue.room_id !== roomFilter) return false;

      // Search keyword
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const descMatch = (issue.description || '').toLowerCase().includes(q);
        const roomMatch = (getRoom(issue.room_id)?.name || '').toLowerCase().includes(q);
        const reporterMatch = (getUser(issue.reported_by)?.email || '').toLowerCase().includes(q);
        return descMatch || roomMatch || reporterMatch;
      }

      return true;
    });
  }, [issues, categoryFilter, roomFilter, searchQuery, getRoom, getUser]);

  // Handle Submit New Report
  const handleCreateReport = async (e) => {
    e.preventDefault();
    if (!reportFormData.roomId) {
      setReportError('Please select a room to report an issue for.');
      return;
    }
    if (!reportFormData.description || reportFormData.description.trim().length < 5) {
      setReportError('Please provide a detailed description (at least 5 characters).');
      return;
    }

    try {
      setIsSubmittingReport(true);
      setReportError(null);

      await issuesApi.create(reportFormData.roomId, {
        category: reportFormData.category,
        description: reportFormData.description.trim(),
      });

      setActionSuccess('Issue report submitted successfully.');
      setIsReportModalOpen(false);
      setReportFormData({
        roomId: '',
        category: 'cleanliness',
        description: '',
      });
      loadData(true);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      console.error('Failed to submit report:', err);
      setReportError(err.message || 'Failed to submit report.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Handle Resolve Issue (updates status to resolved and removes it from the displayed reports)
  const handleResolve = async (issueId) => {
    try {
      setUpdatingIssueId(issueId);
      // Optimistically remove from list
      setIssues((prev) => prev.filter((i) => (i._id || i.id) !== issueId));
      await issuesApi.update(issueId, { status: 'resolved' });
      setActionSuccess('Issue marked as resolved and removed from report issues.');
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err) {
      console.error('Failed to resolve issue:', err);
      setError(err.message || 'Could not resolve issue.');
      loadData(true);
    } finally {
      setUpdatingIssueId(null);
    }
  };

  // Handle Dismiss Issue (updates status to dismissed and removes it from the displayed reports)
  const handleDismiss = async (issueId) => {
    try {
      setUpdatingIssueId(issueId);
      // Optimistically remove from list
      setIssues((prev) => prev.filter((i) => (i._id || i.id) !== issueId));
      await issuesApi.update(issueId, { status: 'dismissed' });
      setActionSuccess('Issue dismissed and removed from report issues.');
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err) {
      console.error('Failed to dismiss issue:', err);
      setError(err.message || 'Could not dismiss issue.');
      loadData(true);
    } finally {
      setUpdatingIssueId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold mb-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Facility Maintenance & Operations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Reported Room Issues
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Track equipment repairs, temperature issues, cleanliness, or submit new maintenance tickets.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            title="Refresh issue list"
            className="p-2.5 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#1977cc]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setReportFormData({
                roomId: rooms[0]?._id || rooms[0]?.id || '',
                category: 'cleanliness',
                description: '',
              });
              setReportError(null);
              setIsReportModalOpen(true);
            }}
            className="px-5 py-2.5 rounded-xl bg-[#1977cc] hover:bg-[#1565b0] text-white font-semibold text-sm shadow-md transition flex items-center space-x-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Report New Issue</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center space-x-3 text-emerald-800 text-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-medium">{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center space-x-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Search & Filter Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Live Search */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search by room name, description, or reporter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1977cc] focus:ring-2 focus:ring-[#1977cc]/20"
            />
          </div>

          {/* Room Filter Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase mr-1">Room:</span>
            <select
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1977cc]/20 cursor-pointer"
            >
              <option value="all">All Rooms</option>
              {rooms.map((r) => (
                <option key={r._id || r.id} value={r._id || r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
          <span className="text-xs font-semibold text-slate-400 uppercase mr-1">Category:</span>
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              categoryFilter === 'all'
                ? 'bg-[#1977cc] text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            All Categories
          </button>
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer ${
                  categoryFilter === cat.id
                    ? 'bg-[#1977cc] text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Issue Reports List */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Reported Issues</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing {filteredIssues.length} active reported {filteredIssues.length === 1 ? 'issue' : 'issues'} requiring attention
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="divide-y divide-slate-100">
            {[1, 2, 3].map((n) => (
              <div key={n} className="p-6 animate-pulse flex flex-col space-y-3">
                <div className="h-5 bg-slate-200 rounded w-1/4" />
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-4 bg-slate-200 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="py-16 px-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-base font-semibold text-slate-800">
              No active issues
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery.trim() || categoryFilter !== 'all' || roomFilter !== 'all'
                ? 'No reported room issues match the current filter or search criteria.'
                : 'All reported room issues have been resolved or dismissed. Great job!'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredIssues.map((issue) => {
              const issueId = issue._id || issue.id;
              const room = getRoom(issue.room_id);
              const reporter = getUser(issue.reported_by);
              const categoryMeta = CATEGORIES.find((c) => c.id === issue.category) || CATEGORIES[4];
              const CategoryIcon = categoryMeta.icon;
              const isUpdating = updatingIssueId === issueId;

              const createdAtFormatted = issue.created_at
                ? formatHKDateTime(issue.created_at)
                : 'Recently';

              return (
                <div
                  key={issueId}
                  className="p-6 hover:bg-slate-50/70 transition flex flex-col sm:flex-row sm:items-center justify-between gap-5"
                >
                  {/* Issue Main Information */}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {/* Room Badge */}
                      <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-xs">
                        <Building className="w-3.5 h-3.5" />
                        <span>{room?.name || 'Meeting Room'}</span>
                      </span>

                      {/* Category Badge */}
                      <span
                        className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${categoryMeta.color}`}
                      >
                        <CategoryIcon className="w-3.5 h-3.5" />
                        <span>{categoryMeta.label}</span>
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-sm font-semibold text-slate-900 leading-snug">
                      {issue.description}
                    </p>

                    {/* Metadata: reporter & date */}
                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Reported {createdAtFormatted}</span>
                      </span>

                      <span>•</span>

                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>By {reporter?.profile?.first_name ? `${reporter.profile.first_name} (${reporter.email})` : reporter?.email || 'User'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Actions: Dismiss & Resolve */}
                  <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleDismiss(issueId)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                      title="Dismiss this report"
                    >
                      <X className="w-4 h-4 text-slate-400" />
                      <span>Dismiss</span>
                    </button>

                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleResolve(issueId)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                      title="Mark as resolved and remove"
                    >
                      <Check className="w-4 h-4" />
                      <span>Resolve</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. REPORT NEW ISSUE MODAL */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 rounded-xl bg-rose-100 text-rose-800">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Report Room Issue</h2>
                  <p className="text-xs text-slate-500">
                    Notify facility administrators and technicians of maintenance needs.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reportError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-2.5 text-red-700 text-xs font-medium">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{reportError}</span>
              </div>
            )}

            <form onSubmit={handleCreateReport} className="space-y-4">
              {/* Room Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Select Room
                </label>
                <select
                  value={reportFormData.roomId}
                  onChange={(e) => setReportFormData((p) => ({ ...p, roomId: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1977cc]/20 focus:border-[#1977cc]"
                  required
                >
                  <option value="">-- Choose a room --</option>
                  {rooms.map((r) => (
                    <option key={r._id || r.id} value={r._id || r.id}>
                      {r.name} {r.amenities?.length ? `(${r.amenities.join(', ')})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Radio Grid */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Issue Category
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {CATEGORIES.map((cat) => {
                    const isSelected = reportFormData.category === cat.id;
                    const Icon = cat.icon;
                    return (
                      <div
                        key={cat.id}
                        onClick={() => setReportFormData((p) => ({ ...p, category: cat.id }))}
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-start space-x-2.5 ${
                          isSelected
                            ? 'border-[#1977cc] bg-blue-50/60 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60'
                        }`}
                      >
                        <input
                          type="radio"
                          name="category"
                          value={cat.id}
                          checked={isSelected}
                          onChange={() => {}}
                          className="mt-1 text-[#1977cc] focus:ring-[#1977cc]"
                        />
                        <div>
                          <div className="flex items-center space-x-1.5 font-bold text-xs text-slate-900">
                            <Icon className="w-3.5 h-3.5 text-[#1977cc]" />
                            <span>{cat.label}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{cat.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Issue Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Issue Details & Description
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. HDMI cable is missing or projector is flashing an error code..."
                  value={reportFormData.description}
                  onChange={(e) => setReportFormData((p) => ({ ...p, description: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1977cc]/20 focus:border-[#1977cc]"
                  required
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="px-5 py-2.5 rounded-xl bg-[#1977cc] hover:bg-[#1565b0] text-white font-semibold text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingReport ? 'Submitting...' : 'Submit Issue Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportIssues;
