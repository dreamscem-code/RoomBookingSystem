import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Users, UserPlus, X, Search, Check, AlertTriangle, ShieldCheck, User } from 'lucide-react';
import { usersApi } from '../api';

/**
 * Reusable Attendee Selection Component
 *
 * @param {Array} value - Current array of attendees [{ user_id, role, name, email }]
 * @param {Function} onChange - Callback function receiving updated attendee array
 * @param {number|null} roomCapacity - Capacity of the currently selected room
 * @param {string} organizerId - ID of current user/creator to exclude from attendee list
 * @param {string} organizerName - Name of current user/creator for display
 * @param {boolean} disabled - Whether the selector is disabled
 */
export default function AttendeeSelector({
  value = [],
  onChange,
  roomCapacity = null,
  organizerId = null,
  organizerName = null,
  disabled = false,
}) {
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch users list once on mount
  useEffect(() => {
    let isMounted = true;
    const loadUsers = async () => {
      try {
        setIsLoadingUsers(true);
        const data = await usersApi.list();
        if (isMounted) {
          setUsers(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to load user list for attendee selection:', err);
      } finally {
        if (isMounted) setIsLoadingUsers(false);
      }
    };
    loadUsers();
    return () => {
      isMounted = false;
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Filter available users (exclude selected and organizer)
  const availableUsers = useMemo(() => {
    const selectedUserIds = new Set((value || []).map((att) => att.user_id));
    return users.filter((u) => {
      const uid = u._id || u.id;
      if (organizerId && uid === organizerId) return false;
      if (selectedUserIds.has(uid)) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const fullName = `${u.profile?.first_name || ''} ${u.profile?.last_name || ''}`.toLowerCase();
      const email = (u.email || '').toLowerCase();
      const team = (u.team || '').toLowerCase();
      return fullName.includes(term) || email.includes(term) || team.includes(term);
    });
  }, [users, value, organizerId, searchTerm]);

  const handleSelectUser = (user) => {
    const uid = user._id || user.id;
    const fullName = `${user.profile?.first_name || ''} ${user.profile?.last_name || ''}`.trim();
    const newAttendee = {
      user_id: uid,
      role: 'attendee',
      name: fullName || user.email,
      email: user.email,
    };
    onChange([...(value || []), newAttendee]);
    setSearchTerm('');
  };

  const handleRemoveAttendee = (userIdToRemove) => {
    onChange((value || []).filter((att) => att.user_id !== userIdToRemove));
  };

  const handleToggleRole = (userId, currentRole) => {
    const newRole = currentRole === 'co-host' ? 'attendee' : 'co-host';
    onChange(
      (value || []).map((att) =>
        att.user_id === userId ? { ...att, role: newRole } : att
      )
    );
  };

  const totalAttendees = (value || []).length;
  // Total participants = attendees + 1 (the organizer)
  const totalParticipants = totalAttendees + 1;
  const isOverCapacity = roomCapacity && totalParticipants > roomCapacity;

  return (
    <div className="space-y-2.5">
      {/* Label and Capacity Status */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
          <Users className="w-3.5 h-3.5 text-[#1977cc]" />
          <span>Attendees & Invitees</span>
          {totalAttendees > 0 && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#1977cc]/10 text-[#1977cc]">
              {totalAttendees}
            </span>
          )}
        </label>

        {roomCapacity && (
          <div
            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center space-x-1 transition ${
              isOverCapacity
                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            {isOverCapacity && <AlertTriangle className="w-3 h-3 text-rose-600" />}
            <span>
              {totalParticipants} / {roomCapacity} seats ({totalAttendees} invited + 1 host)
            </span>
          </div>
        )}
      </div>

      {/* Room Over-capacity Alert */}
      {isOverCapacity && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>
            <strong>Capacity notice:</strong> Total attendance ({totalParticipants}) exceeds this room's maximum capacity of {roomCapacity}.
          </span>
        </div>
      )}

      {/* Organizer indicator pill */}
      {organizerName && (
        <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700 font-medium">
          <div className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold">
            {organizerName.charAt(0).toUpperCase()}
          </div>
          <span className="truncate max-w-[200px]">{organizerName}</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-100 text-[#1977cc]">
            Organizer (Host)
          </span>
        </div>
      )}

      {/* Search & Add User Input */}
      <div className="relative" ref={dropdownRef}>
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            disabled={disabled}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
            placeholder={
              isLoadingUsers
                ? 'Loading directory...'
                : 'Search colleagues by name, email, or department...'
            }
            className="w-full pl-9 pr-9 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1977cc]/20 focus:border-[#1977cc] transition placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Results */}
        {isDropdownOpen && (
          <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-xl py-1.5">
            {isLoadingUsers ? (
              <div className="p-3 text-center text-xs text-slate-500">
                Loading colleagues...
              </div>
            ) : availableUsers.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500">
                {searchTerm
                  ? 'No matching colleagues found.'
                  : 'All available colleagues are already invited.'}
              </div>
            ) : (
              availableUsers.map((user) => {
                const uid = user._id || user.id;
                const fullName = `${user.profile?.first_name || ''} ${
                  user.profile?.last_name || ''
                }`.trim();
                const displayName = fullName || user.email;
                const initial = (fullName || user.email || 'U').charAt(0).toUpperCase();

                return (
                  <button
                    key={uid}
                    type="button"
                    onClick={() => handleSelectUser(user)}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between transition cursor-pointer group"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#1977cc] to-sky-400 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-[#1977cc] transition">
                          {displayName}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {user.team && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">
                          {user.team}
                        </span>
                      )}
                      <UserPlus className="w-4 h-4 text-slate-400 group-hover:text-[#1977cc] transition" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Selected Attendees Chips */}
      {value && value.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1 max-h-48 overflow-y-auto">
          {value.map((att) => {
            const displayName = att.name || att.email || 'Attendee';
            const initial = displayName.charAt(0).toUpperCase();
            const isCoHost = att.role === 'co-host';

            return (
              <div
                key={att.user_id}
                className="inline-flex items-center space-x-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs transition group"
              >
                {/* Avatar */}
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${
                    isCoHost
                      ? 'bg-gradient-to-tr from-amber-500 to-amber-600'
                      : 'bg-gradient-to-tr from-slate-600 to-slate-800'
                  }`}
                >
                  {initial}
                </div>

                {/* Name / Info */}
                <div className="flex items-center space-x-1.5 min-w-0">
                  <span className="text-xs font-semibold text-slate-800 truncate max-w-[130px]">
                    {displayName}
                  </span>

                  {/* Role Toggle Button */}
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleToggleRole(att.user_id, att.role)}
                    title={`Click to switch to ${isCoHost ? 'Attendee' : 'Co-host'}`}
                    className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md transition cursor-pointer ${
                      isCoHost
                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {isCoHost ? 'Co-host' : 'Attendee'}
                  </button>
                </div>

                {/* Remove Button */}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemoveAttendee(att.user_id)}
                    title="Remove attendee"
                    className="text-slate-400 hover:text-rose-600 p-0.5 rounded-md hover:bg-rose-50 transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
