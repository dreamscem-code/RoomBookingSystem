import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  RefreshCw,
  UserCheck,
  UserX,
  Info,
  Sliders,
  Mail,
  Building2,
  Calendar,
  Lock
} from 'lucide-react';

const SYSTEM_ROLES = [
  {
    name: 'admin',
    label: 'Administrator',
    description: 'Full system control, room management, and role assignments.',
    color: 'border-amber-300 bg-amber-50 text-amber-900',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    icon: ShieldAlert,
  },
  {
    name: 'supervisor',
    label: 'Supervisor',
    description: 'Direct room reservations, cancellation reviews, and schedule oversight.',
    color: 'border-sky-300 bg-sky-50 text-sky-900',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-300',
    icon: ShieldCheck,
  },
  {
    name: 'full-time staff',
    label: 'Full-Time Staff',
    description: 'Can book available rooms and request cancellations.',
    color: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    icon: UserCheck,
  },
  {
    name: 'part-time staff',
    label: 'Part-Time Staff',
    description: 'Standard room booking privileges.',
    color: 'border-teal-300 bg-teal-50 text-teal-900',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
    icon: UserCheck,
  },
  {
    name: 'intern',
    label: 'Intern',
    description: 'Assigned to team activities with room reservation privileges.',
    color: 'border-indigo-300 bg-indigo-50 text-indigo-900',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    icon: Users,
  },
  {
    name: 'volunteer',
    label: 'Volunteer',
    description: 'Assisted volunteer access.',
    color: 'border-slate-300 bg-slate-50 text-slate-900',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
    icon: Users,
  },
  {
    name: 'guest',
    label: 'Guest',
    description: 'Read-only access to view schedules.',
    color: 'border-slate-200 bg-slate-50 text-slate-600',
    badgeColor: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: Users,
  },
];

const USER_TYPES = [
  { value: 'full-time', label: 'Full-Time' },
  { value: 'part-time', label: 'Part-Time' },
  { value: 'contractor', label: 'Contractor' },
];

const TEAMS = [
  { value: 'admin', label: 'Admin' },
  { value: 'management', label: 'Management' },
  { value: 'youth', label: 'Youth' },
  { value: 'family', label: 'Family' },
];

export const RoleManagement = () => {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  // Modals state
  const [selectedUserForRoles, setSelectedUserForRoles] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedUserType, setSelectedUserType] = useState('full-time');
  const [selectedTeam, setSelectedTeam] = useState('admin');
  const [isSavingRoles, setIsSavingRoles] = useState(false);
  const [roleModalError, setRoleModalError] = useState(null);

  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Helper: safe user ID
  const getUserId = (u) => u?._id || u?.id;

  // Fetch all users
  const fetchUsers = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const data = await usersApi.list();
      const normalized = (data || []).map((u) => {
        const uid = u._id || u.id;
        return { ...u, id: uid, _id: uid };
      });
      setUsers(normalized);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError(err.message || 'Unable to retrieve users list.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Counts
  const totalCount = users.length;

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Role filter (from top metric cards)
      if (roleFilter !== 'all') {
        const hasRole = u.roles?.some(
          (r) => r.role_name?.toLowerCase() === roleFilter.toLowerCase()
        );
        if (!hasRole) return false;
      }

      // Department filter
      if (departmentFilter !== 'all') {
        const userTeam = (u.team || '').toLowerCase();
        if (userTeam !== departmentFilter.toLowerCase()) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fullName = `${u.profile?.first_name || ''} ${u.profile?.last_name || ''}`.toLowerCase();
        const email = (u.email || '').toLowerCase();
        const team = (u.team || '').toLowerCase();
        return fullName.includes(q) || email.includes(q) || team.includes(q);
      }

      return true;
    });
  }, [users, roleFilter, departmentFilter, searchQuery]);

  // Open Edit Roles Modal
  const handleOpenRoleModal = (u) => {
    setSelectedUserForRoles(u);
    const existing = (u.roles || []).map((r) => r.role_name?.toLowerCase()).filter(Boolean);
    setSelectedRoles(existing.length > 0 ? existing : ['full-time staff']);
    setSelectedUserType(u.user_type || 'full-time');
    setSelectedTeam(u.team || 'admin');
    setRoleModalError(null);
  };

  const handleCloseRoleModal = () => {
    setSelectedUserForRoles(null);
    setSelectedRoles([]);
    setSelectedUserType('full-time');
    setSelectedTeam('admin');
    setRoleModalError(null);
  };

  // Toggle role in modal
  const handleToggleRole = (roleName) => {
    setSelectedRoles((prev) => {
      if (prev.includes(roleName)) {
        // Prevent deselecting all roles
        if (prev.length === 1) return prev;
        return prev.filter((r) => r !== roleName);
      } else {
        return [...prev, roleName];
      }
    });
  };

  // Submit: Save Role Changes
  const handleSaveRoles = async (e) => {
    e.preventDefault();
    if (!selectedUserForRoles) return;
    const userId = getUserId(selectedUserForRoles);
    if (!userId) return;

    if (selectedRoles.length === 0) {
      setRoleModalError('User must have at least one role assigned.');
      return;
    }

    try {
      setIsSavingRoles(true);
      setRoleModalError(null);

      await usersApi.updateRoles(userId, {
        roles: selectedRoles,
        user_type: selectedUserType,
        team: selectedTeam,
      });

      setActionSuccess(
        `Permissions & account type updated for ${selectedUserForRoles.profile?.first_name || selectedUserForRoles.email}.`
      );
      handleCloseRoleModal();
      fetchUsers(true);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      console.error('Failed to update roles:', err);
      setRoleModalError(err.message || 'Failed to update user roles.');
    } finally {
      setIsSavingRoles(false);
    }
  };

  // Open Delete User Confirmation Modal
  const handleOpenDeleteModal = (u) => {
    setUserToDelete(u);
    setDeleteError(null);
  };

  const handleCloseDeleteModal = () => {
    setUserToDelete(null);
    setDeleteError(null);
  };

  // Submit: Delete User
  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    const userId = getUserId(userToDelete);
    if (!userId) return;

    try {
      setIsDeletingUser(true);
      setDeleteError(null);

      await usersApi.delete(userId);

      setActionSuccess(`User ${userToDelete.email} was removed successfully.`);
      handleCloseDeleteModal();
      fetchUsers(true);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      console.error('Failed to delete user:', err);
      setDeleteError(err.message || 'Failed to delete user.');
    } finally {
      setIsDeletingUser(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#1977cc]/10 text-[#1977cc] text-xs font-semibold mb-3">
            <Shield className="w-3.5 h-3.5" />
            <span>Access Control & Security</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Roles & User Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage system roles, configure permissions, and delete user accounts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchUsers(true)}
            disabled={isRefreshing}
            className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-sm transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#1977cc]' : ''}`} />
            <span>Refresh Users</span>
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

      {/* 2. Search & Filter Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search by name, email, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1977cc] focus:ring-2 focus:ring-[#1977cc]/20"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Role Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="py-1.5 px-3 rounded-xl border border-slate-300 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:border-[#1977cc] focus:ring-2 focus:ring-[#1977cc]/20 cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="admin">Administrators</option>
              <option value="supervisor">Supervisors</option>
              <option value="full-time staff">Full-time Staff</option>
              <option value="part-time staff">Part-time Staff</option>
              <option value="intern">Intern</option>
            </select>
          </div>

          {/* Department Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Department:</span>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="py-1.5 px-3 rounded-xl border border-slate-300 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:border-[#1977cc] focus:ring-2 focus:ring-[#1977cc]/20 cursor-pointer"
            >
              <option value="all">All Departments</option>
              <option value="admin">Admin</option>
              <option value="management">Management</option>
              <option value="youth">Youth</option>
              <option value="family">Family</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Users Table / Grid */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">System Users</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing {filteredUsers.length} of {totalCount} registered accounts
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="animate-pulse flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-slate-50/50">
                <div className="flex items-center space-x-3 w-1/3">
                  <div className="w-10 h-10 rounded-full bg-slate-200" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-6 bg-slate-200 rounded w-24" />
                <div className="h-8 bg-slate-200 rounded w-32" />
              </div>
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 px-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Users className="w-6 h-6" />
            </div>
            <p className="text-base font-semibold text-slate-800">No users found</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No registered user accounts match your search query or department filter.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredUsers.map((u) => {
              const uid = getUserId(u);
              const isSelf = getUserId(currentUser) === uid;
              const userRoles = u.roles || [];

              return (
                <div
                  key={uid}
                  className="p-5 sm:px-6 hover:bg-slate-50/70 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* User Profile Info */}
                  <div className="flex items-center space-x-3.5 min-w-[260px]">
                    <div className="w-11 h-11 rounded-full bg-[#1977cc] flex items-center justify-center text-white font-bold text-sm uppercase shadow-sm shrink-0">
                      {u.profile?.first_name?.[0] || u.email?.[0] || 'U'}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-bold text-slate-900 text-sm leading-snug">
                          {u.profile?.first_name ? `${u.profile.first_name} ${u.profile.last_name || ''}` : 'User'}
                        </p>
                        {isSelf && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#1977cc] border border-blue-200">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>{u.email}</span>
                      </p>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="capitalize">
                          Dept: <strong className="text-slate-700">{u.team || 'General'}</strong>
                        </span>
                        <span>•</span>
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[10px] border border-slate-200 capitalize">
                          {u.user_type || 'full-time'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Assigned Roles */}
                  <div className="flex items-center gap-1.5 flex-wrap flex-1 md:justify-center">
                    {userRoles.length > 0 ? (
                      userRoles.map((r, idx) => {
                        const roleMeta = SYSTEM_ROLES.find(
                          (sr) => sr.name === r.role_name?.toLowerCase()
                        );
                        return (
                          <span
                            key={idx}
                            className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold border ${
                              roleMeta?.badgeColor || 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            <Shield className="w-3 h-3" />
                            <span className="capitalize">{r.role_name}</span>
                          </span>
                        );
                      })
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                        No Role Assigned
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 self-end md:self-auto shrink-0">
                    <button
                      onClick={() => handleOpenRoleModal(u)}
                      className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#1977cc]/10 hover:bg-[#1977cc] text-[#1977cc] hover:text-white transition flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Manage Roles</span>
                    </button>

                    <button
                      onClick={() => handleOpenDeleteModal(u)}
                      disabled={isSelf}
                      title={isSelf ? 'You cannot delete your own active account' : 'Delete user account'}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. INTERACTIVE ROLE EDITOR MODAL */}
      {selectedUserForRoles && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Manage User Roles</h2>
                  <p className="text-xs text-slate-500">
                    Assign or update system permissions for{' '}
                    <strong className="text-slate-800">{selectedUserForRoles.email}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseRoleModal}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {roleModalError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-2.5 text-red-700 text-xs font-medium">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{roleModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveRoles} className="space-y-4">
              {/* Account & Employment Classification */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50/90 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Employment Type
                  </label>
                  <select
                    value={selectedUserType}
                    onChange={(e) => setSelectedUserType(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1977cc]/20 focus:border-[#1977cc]"
                  >
                    {USER_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Department / Team
                  </label>
                  <select
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1977cc]/20 focus:border-[#1977cc]"
                  >
                    {TEAMS.map((tm) => (
                      <option key={tm.value} value={tm.value}>
                        {tm.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-1">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  System Roles (Multi-Role Supported)
                </p>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {SYSTEM_ROLES.map((role) => {
                  const isChecked = selectedRoles.includes(role.name);
                  const Icon = role.icon;

                  return (
                    <div
                      key={role.name}
                      onClick={() => handleToggleRole(role.name)}
                      className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start space-x-3 ${
                        isChecked
                          ? `${role.color} shadow-xs font-medium`
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/70'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // Handled by parent div
                        className="mt-1 rounded border-slate-300 text-[#1977cc] focus:ring-[#1977cc] cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <Icon className="w-4 h-4" />
                          <span className="font-bold text-sm capitalize">{role.label}</span>
                        </div>
                        <p className="text-xs opacity-80 mt-0.5">{role.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100 flex items-start space-x-2 text-xs text-blue-800">
                <Info className="w-4 h-4 text-[#1977cc] shrink-0 mt-0.5" />
                <span>
                  Admins have full access to Room Management, Role Management, and cancellation approvals.
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCloseRoleModal}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingRoles}
                  className="px-5 py-2.5 rounded-xl bg-[#1977cc] hover:bg-[#1565b0] text-white font-semibold text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {isSavingRoles ? 'Saving...' : 'Save Role Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. DELETE USER CONFIRMATION MODAL */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Delete User Account</h2>
                <p className="text-xs text-slate-500">Permanent account removal</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Are you sure you want to delete{' '}
              <strong className="text-slate-900">{userToDelete.email}</strong>?
            </p>

            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
              <p className="font-semibold">Important:</p>
              <p>
                The user will be immediately removed and unable to sign in. Any past room reservations created by this user will remain in the database for auditing and schedule integrity.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-red-100 text-red-800 text-xs font-semibold">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={handleCloseDeleteModal}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-medium text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={isDeletingUser}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                {isDeletingUser ? 'Deleting...' : 'Yes, Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleManagement;
