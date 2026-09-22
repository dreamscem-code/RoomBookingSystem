import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { roomsApi } from '../api';
import {
  Building,
  Plus,
  Edit3,
  Trash2,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  RefreshCw,
  Tag,
  ShieldAlert,
  Info,
  Sliders,
  ExternalLink
} from 'lucide-react';

const POPULAR_AMENITIES = [
  'Projector',
  'Whiteboard',
  'Video Conferencing',
  'TV Display',
  'Air Conditioning',
  'Sound System',
  'Microphone',
  'Wheelchair Accessible',
  'Ergonomic Seating',
  'High-Speed Wi-Fi'
];

export const RoomManagement = () => {
  const { user } = useAuth();

  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Filter and search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRoomForDialog, setSelectedRoomForDialog] = useState(null); // When not null, opens the Room Management Dialog Box

  // Form states for Create Modal
  const [createFormData, setCreateFormData] = useState({
    name: '',
    amenities: ['Projector', 'Whiteboard'],
    is_active: true,
  });
  const [customAmenityCreate, setCustomAmenityCreate] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Form states for Manage/Update Dialog Box
  const [editFormData, setEditFormData] = useState({
    name: '',
    amenities: [],
    is_active: true,
  });
  const [customAmenityEdit, setCustomAmenityEdit] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogError, setDialogError] = useState(null);
  const [confirmDeleteStep, setConfirmDeleteStep] = useState(false);

  // Fetch all rooms (active and soft-deleted)
  const fetchRooms = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const data = await roomsApi.list();
      const normalizedRooms = (data || []).map((r) => {
        const id = r._id || r.id;
        return { ...r, id, _id: id };
      });
      setRooms(normalizedRooms);
    } catch (err) {
      console.error('Failed to load rooms:', err);
      setError(err.message || 'Unable to retrieve rooms from server.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Filtered rooms list
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      if (statusFilter === 'active' && room.is_active === false) return false;
      if (statusFilter === 'inactive' && room.is_active !== false) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = room.name?.toLowerCase().includes(query);
        const matchesAmenity = room.amenities?.some((a) => a.toLowerCase().includes(query));
        return matchesName || matchesAmenity;
      }

      return true;
    });
  }, [rooms, statusFilter, searchQuery]);

  // Counts
  const totalCount = rooms.length;
  const activeCount = rooms.filter((r) => r.is_active !== false).length;
  const inactiveCount = rooms.filter((r) => r.is_active === false).length;

  // Handler: Open Create Modal
  const handleOpenCreateModal = () => {
    setCreateFormData({
      name: '',
      amenities: ['Projector', 'Whiteboard'],
      is_active: true,
    });
    setCustomAmenityCreate('');
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  // Handler: Open Interactive Room Dialog Box (Clicking on any room card)
  const handleOpenRoomDialog = (room) => {
    const id = room._id || room.id;
    setSelectedRoomForDialog({ ...room, id, _id: id });
    setEditFormData({
      name: room.name || '',
      amenities: Array.isArray(room.amenities) ? [...room.amenities] : [],
      is_active: room.is_active !== false,
    });
    setCustomAmenityEdit('');
    setDialogError(null);
    setConfirmDeleteStep(false);
  };

  // Handler: Close Interactive Room Dialog Box
  const handleCloseRoomDialog = () => {
    setSelectedRoomForDialog(null);
    setConfirmDeleteStep(false);
    setDialogError(null);
  };

  // Submit: Create Room
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateError(null);

    if (!createFormData.name.trim()) {
      setCreateError('Please provide a valid room name.');
      return;
    }

    try {
      setIsCreating(true);
      await roomsApi.create({
        name: createFormData.name.trim(),
        amenities: createFormData.amenities,
        is_active: createFormData.is_active,
      });

      setIsCreateModalOpen(false);
      setActionSuccess(`Room "${createFormData.name.trim()}" created successfully!`);
      fetchRooms(true);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      console.error('Failed to create room:', err);
      setCreateError(err.message || 'Failed to create room.');
    } finally {
      setIsCreating(false);
    }
  };

  // Submit: Update Room
  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRoomForDialog) return;
    const roomId = selectedRoomForDialog._id || selectedRoomForDialog.id;
    if (!roomId) {
      setDialogError('Room ID is missing.');
      return;
    }
    setDialogError(null);

    if (!editFormData.name.trim()) {
      setDialogError('Room name cannot be blank.');
      return;
    }

    try {
      setIsUpdating(true);
      await roomsApi.update(roomId, {
        name: editFormData.name.trim(),
        amenities: editFormData.amenities,
        is_active: editFormData.is_active,
      });

      setActionSuccess(`Room "${editFormData.name.trim()}" updated successfully!`);
      handleCloseRoomDialog();
      fetchRooms(true);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      console.error('Failed to update room:', err);
      setDialogError(err.message || 'Failed to update room details.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Action: Soft-Delete (Deactivate) Room
  const handleSoftDelete = async () => {
    if (!selectedRoomForDialog) return;
    const roomId = selectedRoomForDialog._id || selectedRoomForDialog.id;
    if (!roomId) {
      setDialogError('Room ID is missing.');
      return;
    }
    setDialogError(null);

    try {
      setIsDeleting(true);
      await roomsApi.delete(roomId);

      setActionSuccess(`Room "${selectedRoomForDialog.name}" has been soft-deleted (deactivated).`);
      handleCloseRoomDialog();
      fetchRooms(true);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      console.error('Failed to soft delete room:', err);
      setDialogError(err.message || 'Failed to soft delete room.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Action: Reactivate (Restore) Room
  const handleReactivate = async () => {
    if (!selectedRoomForDialog) return;
    const roomId = selectedRoomForDialog._id || selectedRoomForDialog.id;
    if (!roomId) {
      setDialogError('Room ID is missing.');
      return;
    }
    setDialogError(null);

    try {
      setIsUpdating(true);
      await roomsApi.update(roomId, { is_active: true });

      setActionSuccess(`Room "${selectedRoomForDialog.name}" has been reactivated!`);
      handleCloseRoomDialog();
      fetchRooms(true);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      console.error('Failed to reactivate room:', err);
      setDialogError(err.message || 'Failed to reactivate room.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Helper to toggle amenity
  const toggleAmenity = (setter, amenity) => {
    setter((prev) => {
      const exists = prev.amenities.includes(amenity);
      return {
        ...prev,
        amenities: exists
          ? prev.amenities.filter((a) => a !== amenity)
          : [...prev.amenities, amenity],
      };
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#1977cc]/10 text-[#1977cc] text-xs font-semibold mb-3">
            <Building className="w-3.5 h-3.5" />
            <span>Facility Administration</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Room Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Click on any available room below to edit details, manage amenities, or soft-delete rooms.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenCreateModal}
            className="px-5 py-2.5 rounded-xl bg-[#1977cc] hover:bg-[#1565b0] text-white font-semibold text-sm shadow-md shadow-[#1977cc]/20 transition flex items-center space-x-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Room</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center space-x-3 text-emerald-800 text-sm animate-fade-in shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-medium">{actionSuccess}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center space-x-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Interactive Stats Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-[#1977cc]/10 border-[#1977cc] shadow-sm'
              : 'bg-white border-slate-200/90 hover:bg-slate-50'
          }`}
        >
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Spaces
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('active')}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
            statusFilter === 'active'
              ? 'bg-emerald-50 border-emerald-500 shadow-sm'
              : 'bg-white border-slate-200/90 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              Active & Bookable
            </p>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{activeCount}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('inactive')}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
            statusFilter === 'inactive'
              ? 'bg-amber-50 border-amber-500 shadow-sm'
              : 'bg-white border-slate-200/90 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
              Soft-Deleted (Inactive)
            </p>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{inactiveCount}</p>
        </button>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search by room name or amenity (e.g. Projector)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1977cc] focus:ring-2 focus:ring-[#1977cc]/20"
          />
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto flex-wrap">
          {/* Status Filter Tabs */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                statusFilter === 'inactive'
                  ? 'bg-white text-amber-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Soft-Deleted ({inactiveCount})
            </button>
          </div>

          <button
            onClick={() => fetchRooms(true)}
            disabled={isRefreshing}
            title="Refresh Rooms"
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#1977cc]' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4. Available Rooms Grid */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Available Rooms</h2>
          <p className="text-xs text-slate-500 mt-0.5">Click any room card to open the interactive update & deletion dialog box</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white border border-slate-200/80 rounded-2xl p-6 animate-pulse space-y-4">
                <div className="h-5 bg-slate-200 rounded w-1/2" />
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-8 bg-slate-200 rounded w-full pt-4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Interactive "Create New Room" Quick Card inside grid */}
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="border-2 border-dashed border-[#1977cc]/40 hover:border-[#1977cc] bg-[#1977cc]/5 hover:bg-[#1977cc]/10 rounded-2xl p-6 transition flex flex-col items-center justify-center text-center group cursor-pointer min-h-[220px]"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#1977cc]/10 group-hover:bg-[#1977cc] text-[#1977cc] group-hover:text-white flex items-center justify-center transition shadow-sm mb-3">
                <Plus className="w-6 h-6" />
              </div>
              <p className="font-bold text-slate-900 group-hover:text-[#1977cc] text-base transition">
                Create More Rooms
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
                Add a new conference room, classroom, or activity space
              </p>
            </button>

            {/* Room Cards: CLICKABLE TO OPEN INTERACTIVE DIALOG BOX */}
            {filteredRooms.map((room) => {
              const roomId = room._id || room.id;
              const isActive = room.is_active !== false;

              return (
                <div
                  key={roomId}
                  onClick={() => handleOpenRoomDialog(room)}
                  className={`bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between group relative ${
                    isActive
                      ? 'border-slate-200/90 hover:border-[#1977cc]'
                      : 'border-amber-200 bg-amber-50/20 hover:border-amber-400'
                  }`}
                >
                  <div>
                    {/* Top line: Name & Status */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center space-x-2.5">
                        <div
                          className={`p-2.5 rounded-xl transition ${
                            isActive
                              ? 'bg-[#1977cc]/10 text-[#1977cc] group-hover:bg-[#1977cc] group-hover:text-white'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          <Building className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-lg leading-tight group-hover:text-[#1977cc] transition">
                            {room.name}
                          </h3>
                          <p className="text-[11px] text-slate-400 mt-0.5">Click to configure</p>
                        </div>
                      </div>

                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center space-x-1.5 ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isActive ? 'bg-emerald-500' : 'bg-amber-600'
                          }`}
                        />
                        <span>{isActive ? 'Active' : 'Soft-Deleted'}</span>
                      </span>
                    </div>

                    {/* Amenities Tag Badges */}
                    <div className="mt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Amenities ({room.amenities?.length || 0})
                      </p>
                      {room.amenities && room.amenities.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {room.amenities.map((amenity, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium"
                            >
                              <Tag className="w-3 h-3 text-slate-400" />
                              <span>{amenity}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No amenities specified</p>
                      )}
                    </div>
                  </div>

                  {/* Card Bottom: Click trigger */}
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#1977cc]">
                    <span className="flex items-center space-x-1.5">
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Manage & Delete Room</span>
                    </span>
                    <span className="text-slate-400 group-hover:translate-x-0.5 transition">→</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. INTERACTIVE DIALOG BOX: UPDATE & SOFT DELETION */}
      {selectedRoomForDialog && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6">
            {/* Dialog Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 rounded-xl bg-[#1977cc]/10 text-[#1977cc]">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Manage Room
                  </h2>
                  <p className="text-xs text-slate-500">
                    Update room name, amenities, or perform soft deletion
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseRoomDialog}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dialog Error Banner */}
            {dialogError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-2.5 text-red-700 text-xs font-medium">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{dialogError}</span>
              </div>
            )}

            {/* Update Form Section */}
            <form onSubmit={handleUpdateSubmit} className="space-y-4">
              {/* Room Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Room Name
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  placeholder="e.g. Conference Room A"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#1977cc] focus:ring-2 focus:ring-[#1977cc]/20"
                />
              </div>

              {/* Status Indicator / Switch */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <p className="text-xs font-semibold text-slate-800">Booking Availability</p>
                  <p className="text-[11px] text-slate-500">
                    {editFormData.is_active
                      ? 'Active: Available for reservations'
                      : 'Soft-Deleted: Hidden from booking forms'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFormData.is_active}
                    onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1977cc]"></div>
                </label>
              </div>

              {/* Amenities Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Configure Amenities
                </label>
                <div className="flex flex-wrap gap-1.5 mb-3 max-h-32 overflow-y-auto pr-1">
                  {POPULAR_AMENITIES.map((amenity) => {
                    const selected = editFormData.amenities.includes(amenity);
                    return (
                      <button
                        key={amenity}
                        type="button"
                        onClick={() => toggleAmenity(setEditFormData, amenity)}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition cursor-pointer ${
                          selected
                            ? 'bg-[#1977cc] text-white border-[#1977cc]'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {selected ? '✓ ' : '+ '}
                        {amenity}
                      </button>
                    );
                  })}
                </div>

                {/* Selected Amenities Pills with remove X */}
                {editFormData.amenities.length > 0 && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 mb-2">
                    <p className="text-[11px] font-semibold text-slate-500">Selected Amenities ({editFormData.amenities.length}):</p>
                    <div className="flex flex-wrap gap-1.5">
                      {editFormData.amenities.map((amenity) => (
                        <span
                          key={amenity}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-xs font-semibold text-slate-800 shadow-2xs"
                        >
                          <span>{amenity}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setEditFormData((prev) => ({
                                ...prev,
                                amenities: prev.amenities.filter((a) => a !== amenity),
                              }))
                            }
                            className="text-slate-400 hover:text-rose-600 transition ml-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Amenity Input */}
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Add custom amenity (press Enter)..."
                    value={customAmenityEdit}
                    onChange={(e) => setCustomAmenityEdit(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = customAmenityEdit.trim();
                        if (val && !editFormData.amenities.includes(val)) {
                          setEditFormData((prev) => ({
                            ...prev,
                            amenities: [...prev.amenities, val],
                          }));
                          setCustomAmenityEdit('');
                        }
                      }
                    }}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1977cc]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = customAmenityEdit.trim();
                      if (val && !editFormData.amenities.includes(val)) {
                        setEditFormData((prev) => ({
                          ...prev,
                          amenities: [...prev.amenities, val],
                        }));
                        setCustomAmenityEdit('');
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Update Save Button */}
              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#1977cc] hover:bg-[#1565b0] text-white font-semibold text-sm shadow-md transition disabled:opacity-50 cursor-pointer text-center"
                >
                  {isUpdating ? 'Saving Changes...' : 'Update Room Details'}
                </button>
              </div>
            </form>

            {/* ---------------- DELETION & REACTIVATION SECTION ---------------- */}
            <div className="pt-5 border-t border-slate-200">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Room Lifecycle & Deletion
              </p>

              {selectedRoomForDialog.is_active !== false ? (
                /* Room is active -> Option for Soft Deletion */
                <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200 space-y-3">
                  <div className="flex items-start space-x-2.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-rose-800">
                        Soft-Delete (Deactivate) this Room
                      </p>
                      <p className="text-[11px] text-rose-700 mt-0.5">
                        Deactivating removes this room from the booking pool. All historical bookings, attendees, and logs remain completely intact. You can reactivate it anytime.
                      </p>
                    </div>
                  </div>

                  {!confirmDeleteStep ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteStep(true)}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete / Deactivate Room</span>
                    </button>
                  ) : (
                    <div className="p-3 bg-white rounded-xl border border-rose-300 space-y-2">
                      <p className="text-xs font-semibold text-rose-900">
                        Confirm: Soft-delete "{selectedRoomForDialog.name}"?
                      </p>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={handleSoftDelete}
                          disabled={isDeleting}
                          className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50"
                        >
                          {isDeleting ? 'Deactivating...' : 'Yes, Soft-Delete'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteStep(false)}
                          className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 font-medium text-xs hover:bg-slate-50 transition cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Room is soft-deleted -> Option for Reactivation */
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                  <div className="flex items-start space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-emerald-800">
                        This room is currently Soft-Deleted
                      </p>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        Reactivate this room to immediately make it bookable again across the Schedule and Calendar.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleReactivate}
                    disabled={isUpdating}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{isUpdating ? 'Reactivating...' : 'Reactivate Room'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. CREATE ROOM MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-[#1977cc]/10 text-[#1977cc]">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Create New Room</h2>
                  <p className="text-xs text-slate-500">Configure a new meeting space or facility</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-2.5 text-red-700 text-xs font-medium">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Room Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Conference Room B, Studio 2"
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#1977cc] focus:ring-2 focus:ring-[#1977cc]/20"
                />
              </div>

              {/* Amenities */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Amenities
                </label>
                <div className="flex flex-wrap gap-1.5 mb-3 max-h-32 overflow-y-auto pr-1">
                  {POPULAR_AMENITIES.map((amenity) => {
                    const selected = createFormData.amenities.includes(amenity);
                    return (
                      <button
                        key={amenity}
                        type="button"
                        onClick={() => toggleAmenity(setCreateFormData, amenity)}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition cursor-pointer ${
                          selected
                            ? 'bg-[#1977cc] text-white border-[#1977cc]'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {selected ? '✓ ' : '+ '}
                        {amenity}
                      </button>
                    );
                  })}
                </div>

                {/* Selected Amenities Pills */}
                {createFormData.amenities.length > 0 && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 mb-2">
                    <p className="text-[11px] font-semibold text-slate-500">Selected Amenities ({createFormData.amenities.length}):</p>
                    <div className="flex flex-wrap gap-1.5">
                      {createFormData.amenities.map((amenity) => (
                        <span
                          key={amenity}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-xs font-semibold text-slate-800 shadow-2xs"
                        >
                          <span>{amenity}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setCreateFormData((prev) => ({
                                ...prev,
                                amenities: prev.amenities.filter((a) => a !== amenity),
                              }))
                            }
                            className="text-slate-400 hover:text-rose-600 transition ml-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Amenity Adder */}
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Add custom amenity..."
                    value={customAmenityCreate}
                    onChange={(e) => setCustomAmenityCreate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = customAmenityCreate.trim();
                        if (val && !createFormData.amenities.includes(val)) {
                          setCreateFormData((prev) => ({
                            ...prev,
                            amenities: [...prev.amenities, val],
                          }));
                          setCustomAmenityCreate('');
                        }
                      }
                    }}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1977cc]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = customAmenityCreate.trim();
                      if (val && !createFormData.amenities.includes(val)) {
                        setCreateFormData((prev) => ({
                          ...prev,
                          amenities: [...prev.amenities, val],
                        }));
                        setCustomAmenityCreate('');
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2.5 rounded-xl bg-[#1977cc] hover:bg-[#1565b0] text-white font-semibold text-sm shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {isCreating ? 'Creating...' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomManagement;
