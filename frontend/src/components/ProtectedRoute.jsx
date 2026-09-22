import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, ShieldAlert } from 'lucide-react';

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-600">
        <Loader2 className="w-10 h-10 text-[#1977cc] animate-spin mb-4" />
        <p className="text-sm font-medium tracking-wide">Loading workspace...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const userRoleNames = user?.roles?.map((r) => r.role_name?.toLowerCase()) || [];
    const hasRole = allowedRoles.some((role) => userRoleNames.includes(role.toLowerCase()));
    if (!hasRole) {
      return (
        <div className="min-h-[80vh] bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-8 rounded-2xl text-center border border-slate-200/90 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100 shadow-xs">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h2>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              This page is restricted to administrators only. You do not possess the necessary permissions to access this view.
            </p>
            <Link
              to="/"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#1977cc] hover:bg-[#1565b0] text-white font-medium text-sm transition shadow-sm"
            >
              Return to Schedule
            </Link>
          </div>
        </div>
      );
    }
  }

  return children;
};

export default ProtectedRoute;
