import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/** Sends signed-out visitors to Sign in, then back here afterwards. `admin` also requires the admin role. */
export default function ProtectedRoute({ children, admin = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="mx-auto max-w-6xl px-4 py-14 text-granite-500 sm:px-6">Loading…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}
