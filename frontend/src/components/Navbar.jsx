import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import {
  Home,
  CalendarDays,
  Building,
  ShieldCheck,
  LogOut,
  Shield,
  Menu,
  X,
  User as UserIcon,
  AlertTriangle,
  Settings
} from 'lucide-react';

export const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMobileMenuOpen(false);
  };

  const isAdmin = user?.roles?.some((r) => r.role_name?.toLowerCase() === 'admin');

  const isActive = (path) => {

    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Title */}
          <Link
            to="/"
            className="flex items-center space-x-2 group"
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-[#1977cc] transition-colors">
              ISSHK Dream Center
            </span>
          </Link>

          {/* Desktop Nav Items & User Actions */}
          <div className="hidden md:flex items-center space-x-2">
            {isAuthenticated && (
              <>
                {/* Home Nav Link */}
                <Link
                  to="/"
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-sm font-medium transition ${isActive('/')
                    ? 'bg-[#1977cc]/10 text-[#1977cc] font-semibold'
                    : 'text-slate-600 hover:text-[#1977cc] hover:bg-slate-100/80'
                    }`}
                >
                  <Home className={`w-4 h-4 ${isActive('/') ? 'text-[#1977cc]' : 'text-slate-400'}`} />
                  <span>Home</span>
                </Link>

                {/* Calendar View Bookings Nav Link */}
                <Link
                  to="/calendar"
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-sm font-medium transition ${isActive('/calendar')
                    ? 'bg-[#1977cc]/10 text-[#1977cc] font-semibold'
                    : 'text-slate-600 hover:text-[#1977cc] hover:bg-slate-100/80'
                    }`}
                >
                  <CalendarDays className={`w-4 h-4 ${isActive('/calendar') ? 'text-[#1977cc]' : 'text-slate-400'}`} />
                  <span>Calendar</span>
                </Link>

                {/* Report Issues Nav Link */}
                <Link
                  to="/issues"
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-sm font-medium transition ${isActive('/issues')
                    ? 'bg-[#1977cc]/10 text-[#1977cc] font-semibold'
                    : 'text-slate-600 hover:text-[#1977cc] hover:bg-slate-100/80'
                    }`}
                >
                  <AlertTriangle className={`w-4 h-4 ${isActive('/issues') ? 'text-[#1977cc]' : 'text-slate-400'}`} />
                  <span>Report Issues</span>
                </Link>

                {/* Admin Only Navigation Links */}
                {isAdmin && (
                  <>
                    <Link
                      to="/rooms"
                      className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-sm font-medium transition ${isActive('/rooms')
                        ? 'bg-[#1977cc]/10 text-[#1977cc] font-semibold'
                        : 'text-slate-600 hover:text-[#1977cc] hover:bg-slate-100/80'
                        }`}
                    >
                      <Building className={`w-4 h-4 ${isActive('/rooms') ? 'text-[#1977cc]' : 'text-slate-400'}`} />
                      <span>Rooms</span>
                    </Link>

                    <Link
                      to="/roles"
                      className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-sm font-medium transition ${isActive('/roles')
                        ? 'bg-[#1977cc]/10 text-[#1977cc] font-semibold'
                        : 'text-slate-600 hover:text-[#1977cc] hover:bg-slate-100/80'
                        }`}
                    >
                      <ShieldCheck className={`w-4 h-4 ${isActive('/roles') ? 'text-[#1977cc]' : 'text-slate-400'}`} />
                      <span>Roles</span>
                    </Link>
                  </>
                )}

                {/* Notification Bell */}
                <div className="pl-1">
                  <NotificationBell />
                </div>

                {/* User Info Pill / Profile Link */}
                <div className="flex items-center space-x-2 pl-3 border-l border-slate-200 ml-1">
                  <Link
                    to="/profile"
                    title="Profile & Settings"
                    className={`flex items-center space-x-2.5 p-1.5 rounded-xl transition group ${isActive('/profile')
                      ? 'bg-[#1977cc]/10 ring-1 ring-[#1977cc]/30'
                      : 'hover:bg-slate-100/80'
                      }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-[#1977cc] flex items-center justify-center text-white text-xs font-semibold uppercase shadow-xs group-hover:scale-105 transition-transform">
                      {user?.profile?.first_name?.[0] || user?.email?.[0] || 'U'}
                    </div>
                    <div className="text-left hidden lg:block">
                      <p className="text-xs font-semibold text-slate-800 leading-tight group-hover:text-[#1977cc] transition">
                        {user?.profile?.first_name
                          ? `${user.profile.first_name} ${user.profile.last_name || ''}`
                          : user?.email}
                      </p>
                      <p className="text-[11px] text-slate-500 capitalize">
                        {user?.roles?.some((r) => r.role_name === 'admin')
                          ? 'Administrator'
                          : user?.team
                            ? `${user.team} Team`
                            : 'Member'}
                      </p>
                    </div>
                  </Link>

                  {/* Logout Button */}
                  <button
                    onClick={handleLogout}
                    title="Sign Out"
                    className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Mobile Header Right Items */}
          <div className="flex md:hidden items-center space-x-2">
            {isAuthenticated && (
              <>
                <NotificationBell />
                <Link
                  to="/profile"
                  className="w-8 h-8 rounded-full bg-[#1977cc] flex items-center justify-center text-white text-xs font-semibold uppercase shadow-xs"
                  aria-label="Profile"
                >
                  {user?.profile?.first_name?.[0] || user?.email?.[0] || 'U'}
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown / Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-3 shadow-lg">
          {isAuthenticated && (
            <>
              {/* User summary in mobile drawer */}
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 flex items-center justify-between mb-2 transition"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-[#1977cc] flex items-center justify-center text-white text-xs font-bold uppercase">
                    {user?.profile?.first_name?.[0] || user?.email?.[0] || 'U'}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      {user?.profile?.first_name
                        ? `${user.profile.first_name} ${user.profile.last_name || ''}`
                        : user?.email}
                    </p>
                    <p className="text-[11px] text-slate-500 capitalize">
                      {user?.team ? `${user.team} Team` : 'Member'} •{' '}
                      {user?.roles?.map((r) => r.role_name).join(', ') || 'Staff'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-[#1977cc]">Settings &gt;</span>
              </Link>

              {/* Navigation Links */}
              <div className="space-y-1">
                <Link
                  to="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${isActive('/')
                    ? 'bg-[#1977cc]/10 text-[#1977cc] font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                    }`}
                >
                  <Home className={`w-4 h-4 ${isActive('/') ? 'text-[#1977cc]' : 'text-slate-400'}`} />
                  <span>Home (Today's Schedule)</span>
                </Link>

                <Link
                  to="/calendar"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${isActive('/calendar')
                    ? 'bg-[#1977cc]/10 text-[#1977cc] font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                    }`}
                >
                  <CalendarDays className={`w-4 h-4 ${isActive('/calendar') ? 'text-[#1977cc]' : 'text-slate-400'}`} />
                  <span>Calendar View Bookings</span>
                </Link>

                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${isActive('/profile')
                    ? 'bg-[#1977cc]/10 text-[#1977cc] font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                    }`}
                >
                  <UserIcon className={`w-4 h-4 ${isActive('/profile') ? 'text-[#1977cc]' : 'text-slate-400'}`} />
                  <span>Profile & Password</span>
                </Link>

                <Link
                  to="/issues"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${isActive('/issues')
                    ? 'bg-[#1977cc]/10 text-[#1977cc] font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                    }`}
                >
                  <AlertTriangle className={`w-4 h-4 ${isActive('/issues') ? 'text-[#1977cc]' : 'text-slate-400'}`} />
                  <span>Report Issues</span>
                </Link>

                {/* Admin Only Mobile Navigation Links */}
                {isAdmin && (
                  <>
                    <Link
                      to="/rooms"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${isActive('/rooms')
                        ? 'bg-[#1977cc]/10 text-[#1977cc] font-semibold'
                        : 'text-slate-700 hover:bg-slate-100'
                        }`}
                    >
                      <Building className={`w-4 h-4 ${isActive('/rooms') ? 'text-[#1977cc]' : 'text-slate-400'}`} />
                      <span>Room Management</span>
                    </Link>

                    <Link
                      to="/roles"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${isActive('/roles')
                        ? 'bg-[#1977cc]/10 text-[#1977cc] font-semibold'
                        : 'text-slate-700 hover:bg-slate-100'
                        }`}
                    >
                      <ShieldCheck className={`w-4 h-4 ${isActive('/roles') ? 'text-[#1977cc]' : 'text-slate-400'}`} />
                      <span>Roles Management</span>
                    </Link>
                  </>
                )}
              </div>

              {/* Mobile Sign Out Button */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
