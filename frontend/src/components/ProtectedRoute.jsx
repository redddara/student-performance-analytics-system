import { Navigate } from "react-router-dom";

function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));

  // Not logged in
  if (!token || !user) {
    return <Navigate to="/" />;
  }

  // Role not allowed
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Optional: redirect to dashboard or show message
    return <Navigate to="/dashboard" />;
  }

  return children;
}

export default ProtectedRoute;