import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Auth Pages
import { LoginPage, RegisterPage } from './pages/auth';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminCourses from './pages/admin/Courses';
import AdminSubjects from './pages/admin/Subjects';
import AdminAnalytics from './pages/admin/Analytics';

// Teacher Pages
import TeacherDashboard from './pages/teacher/Dashboard';
import TeacherSubjects from './pages/teacher/MySubjects';
import TeacherGrades from './pages/teacher/Grades';
import TeacherAnalytics from './pages/teacher/Analytics';

// Student Pages
import StudentDashboard from './pages/student/Dashboard';
import StudentSubjects from './pages/student/Subjects';
import StudentGrades from './pages/student/Grades';
import StudentAnalytics from './pages/student/Analytics';

// Layouts
import { AuthLayout } from './components/layouts';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Routes */}
        <Route path="/auth/login" element={
          <AuthLayout>
            <LoginPage />
          </AuthLayout>
        } />
        <Route path="/auth/register" element={
          <AuthLayout>
            <RegisterPage />
          </AuthLayout>
        } />

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/courses" element={<AdminCourses />} />
        <Route path="/admin/subjects" element={<AdminSubjects />} />
        <Route path="/admin/analytics" element={<AdminAnalytics />} />

        {/* Teacher Routes */}
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/teacher/my-subjects" element={<TeacherSubjects />} />
        <Route path="/teacher/grades" element={<TeacherGrades />} />
        <Route path="/teacher/analytics" element={<TeacherAnalytics />} />

        {/* Student Routes */}
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/subjects" element={<StudentSubjects />} />
        <Route path="/student/grades" element={<StudentGrades />} />
        <Route path="/student/analytics" element={<StudentAnalytics />} />

        {/* Default Redirect */}
        <Route path="/" element={<Navigate to="/auth/login" replace />} />
        <Route path="*" element={<Navigate to="/auth/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
