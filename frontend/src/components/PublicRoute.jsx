import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * PublicRoute prevents authenticated users from viewing public auth pages
 * (such as /login and /signup). If the user is already logged in, they are
 * redirected directly to the home dashboard.
 */
export const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-600">
        <Loader2 className="w-10 h-10 text-[#1977cc] animate-spin mb-4" />
        <p className="text-sm font-medium tracking-wide">Loading workspace...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default PublicRoute;
