import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AddGrade from "./pages/AddGrade";
import Students from "./pages/Students";
import MyGrades from "./pages/MyGrades";
import Users from "./pages/Users";
import Grades from "./pages/Grades";
import Analytics from "./pages/Analytics";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Routes>
      {/* Public route */}
      <Route path="/" element={<Login />} />

      {/* Dashboard accessible by anyone logged in */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* Admin-only routes */}
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <Users />
          </ProtectedRoute>
        }
      />

      <Route
        path="/grades"
        element={
          <ProtectedRoute>
            <Grades />
          </ProtectedRoute>
        }
      />

      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        }
      />

      {/* Teacher-only pages */}
      <Route
        path="/add-grade"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <AddGrade />
          </ProtectedRoute>
        }
      />
      <Route
        path="/students"
        element={
          <ProtectedRoute allowedRoles={["teacher", "admin"]}>
            <Students />
          </ProtectedRoute>
        }
      />

      {/* Student-only page */}
      <Route
        path="/my-grades"
        element={
          <ProtectedRoute allowedRoles={["student", "teacher", "admin"]}>
            <MyGrades />
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <Users />
          </ProtectedRoute>
        }
      />

      <Route
        path="/grades"
        element={
          <ProtectedRoute>
            <Grades />
          </ProtectedRoute>
        }
      />

      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        }
      />

      {/* Catch-all route for unknown paths */}
      <Route path="*" element={<div>Page not found</div>} />
    </Routes>
  );
}

export default App;