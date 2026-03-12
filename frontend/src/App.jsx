import { Routes, Route } from "react-router-dom";
import "./App.css";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AddGrade from "./pages/AddGrade";
import Students from "./pages/Students";
import MyGrades from "./pages/MyGrades";
import Users from "./pages/Users";
import Grades from "./pages/Grades";
import Analytics from "./pages/Analytics";
import Courses from "./pages/Course";
import Subjects from "./pages/Subject";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  const user = JSON.parse(localStorage.getItem("user"));

  return (
    <Routes>

      {/* Public */}
      <Route path="/" element={<Login />} />

      {/* All protected routes with sidebar layout */}
      <Route
        element={
          <ProtectedRoute>
            <Layout role={user?.role} />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Admin */}
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <Users />
            </ProtectedRoute>
          }
        />

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

        {/* Student */}
        <Route
          path="/my-grades"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <MyGrades />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 404 */}
      <Route path="*" element={<div>Page not found</div>} />

    </Routes>
  );
}

export default App;