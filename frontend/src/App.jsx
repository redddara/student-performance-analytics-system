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
import Courses from "./pages/Course";
import Subjects from "./pages/Subject";

function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Login />} />

      {/* Dashboard (All logged in users) */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* Admin */}
      <Route
        path="/users"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <Users />
          </ProtectedRoute>
        }
      />

      {/* Teacher + Admin */}
      <Route
        path="/grades"
        element={
          <ProtectedRoute allowedRoles={["teacher", "admin"]}>
            <Grades />
          </ProtectedRoute>
        }
      />

      <Route
        path="/analytics"
        element={
          <ProtectedRoute allowedRoles={["teacher", "admin"]}>
            <Analytics />
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

      <Route
        path="/add-grade"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <AddGrade />
          </ProtectedRoute>
        }
      />

      {/* Student only */}
      <Route
        path="/my-grades"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <MyGrades />
          </ProtectedRoute>
        }
      />
      {/* Admin */}
      <Route
        path="/courses"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <Courses />
          </ProtectedRoute>
        }
      />

      <Route
        path="/subjects"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <Subjects />
          </ProtectedRoute>
        }
      />

      {/* 404 */}
      <Route path="*" element={<div>Page not found</div>} />

    </Routes>
    
  );
}

export default App;