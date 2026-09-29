import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { user, loading, sessionError } = useAuth();

  if (loading) {
    return (
      <div className="p-12 text-center" role="status">
        Loading your account…
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="mx-auto mt-16 max-w-lg card">
        <p className="error-box" role="alert">
          {sessionError}
        </p>

        <button
          className="btn-primary mt-4"
          onClick={() => window.location.reload()}
        >
          Retry connection
        </button>
      </div>
    );
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />;
}