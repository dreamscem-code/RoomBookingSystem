import React, { useState, useEffect, useRef, useCallback } from 'react';
import { notificationsApi } from '../api';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  Calendar,
  AlertCircle,
  X,
  Loader2,
  Inbox,
  Trash2
} from 'lucide-react';

export const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationsApi.list({ limit: 30 });
      setNotifications(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }, []);

  // Initial load and periodic refresh
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // 30s polling
    const handleFocus = () => fetchNotifications();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchNotifications]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Count unread notifications
  const unreadCount = notifications.filter(
    (n) => n.status !== 'read' && !n.read_at
  ).length;

  // Mark single notification as read
  const handleMarkAsRead = async (id, event) => {
    event?.stopPropagation();
    try {
      await notificationsApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === id || n.id === id
            ? { ...n, status: 'read', read_at: new Date().toISOString() }
            : n
        )
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    setIsLoading(true);
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          status: 'read',
          read_at: new Date().toISOString(),
        }))
      );
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear all notifications
  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    setIsLoading(true);
    try {
      await notificationsApi.clearAll();
      setNotifications([]);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete single notification
  const handleDeleteSingle = async (id, event) => {
    event?.stopPropagation();
    try {
      await notificationsApi.delete(id);
      setNotifications((prev) => prev.filter((n) => (n._id || n.id) !== id));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  // Format relative time
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Just now';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  };

  const getNotificationIcon = (title = '', message = '') => {
    const text = (title + ' ' + message).toLowerCase();
    if (text.includes('cancel') || text.includes('reject') || text.includes('issue')) {
      return <AlertCircle className="w-4 h-4 text-amber-500" />;
    }
    if (text.includes('book') || text.includes('schedule') || text.includes('room')) {
      return <Calendar className="w-4 h-4 text-[#1977cc]" />;
    }
    return <Bell className="w-4 h-4 text-slate-500" />;
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Popover Dropdown */}
      {isOpen && (
        <div className="origin-top-right absolute right-0 sm:right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white shadow-2xl border border-slate-200/90 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#1977cc]/10 text-[#1977cc]">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center space-x-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={isLoading}
                  className="text-xs font-medium text-[#1977cc] hover:text-[#1565b0] hover:bg-[#1977cc]/5 px-2 py-1 rounded-lg transition cursor-pointer flex items-center space-x-1"
                  title="Mark all as read"
                >
                  {isLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <CheckCheck className="w-3.5 h-3.5" />
                  )}
                  <span>Mark read</span>
                </button>
              )}

              {/* Clear all button */}
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  disabled={isLoading}
                  className="text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg transition cursor-pointer flex items-center space-x-1"
                  title="Clear all notifications"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}

              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification Items List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Inbox className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800">All caught up!</p>
                <p className="text-xs text-slate-500 mt-1">No notifications in your inbox.</p>
              </div>
            ) : (
              notifications.map((item) => {
                const notifId = item._id || item.id;
                const isUnread = item.status !== 'read' && !item.read_at;

                return (
                  <div
                    key={notifId}
                    onClick={() => isUnread && handleMarkAsRead(notifId)}
                    className={`group p-3.5 flex items-start space-x-3 transition cursor-pointer ${
                      isUnread
                        ? 'bg-[#1977cc]/[0.03] hover:bg-[#1977cc]/[0.07]'
                        : 'hover:bg-slate-50/80 opacity-85 hover:opacity-100'
                    }`}
                  >
                    {/* Icon container */}
                    <div
                      className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center mt-0.5 ${
                        isUnread
                          ? 'bg-blue-50 border border-blue-100'
                          : 'bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {getNotificationIcon(item.title, item.message)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1">
                        <p
                          className={`text-xs font-semibold truncate ${
                            isUnread ? 'text-slate-900' : 'text-slate-700'
                          }`}
                        >
                          {item.title || 'System Notification'}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0 flex items-center">
                          <Clock className="w-2.5 h-2.5 mr-0.5" />
                          {formatTimeAgo(item.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>
                    </div>

                    {/* Action buttons (mark read and delete) */}
                    <div className="flex items-center space-x-1 shrink-0">
                      {isUnread && (
                        <button
                          onClick={(e) => handleMarkAsRead(notifId, e)}
                          title="Mark as read"
                          className="text-slate-400 hover:text-[#1977cc] p-1 rounded-md hover:bg-white transition cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDeleteSingle(notifId, e)}
                        title="Delete notification"
                        className="text-slate-300 hover:text-rose-600 p-1 rounded-md hover:bg-white transition cursor-pointer opacity-70 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with Clear All Option */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="text-[11px] text-slate-400">
                {notifications.length} notification{notifications.length === 1 ? '' : 's'}
              </span>
              <button
                onClick={handleClearAll}
                disabled={isLoading}
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 transition cursor-pointer flex items-center space-x-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear All Notifications</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
