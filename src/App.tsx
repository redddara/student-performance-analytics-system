import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Auth Pages
const LoginPage = React.lazy(() => import('./pages/auth').then(module => ({ default: module.LoginPage })));
const RegisterPage = React.lazy(() => import('./pages/auth').then(module => ({ default: module.RegisterPage })));

// Admin Pages
const AdminDashboard = React.lazy(() => import('./pages/admin/Dashboard'));
const AdminUsers = React.lazy(() => import('./pages/admin/Users'));
const AdminCourses = React.lazy(() => import('./pages/admin/Courses'));
const AdminSubjects = React.lazy(() => import('./pages/admin/Subjects'));
const AdminAnalytics = React.lazy(() => import('./pages/admin/Analytics'));
const AdminEnrollment = React.lazy(() => import('./pages/admin/Enrollment'));

// Teacher Pages
const TeacherDashboard = React.lazy(() => import('./pages/teacher/Dashboard'));
const TeacherSubjects = React.lazy(() => import('./pages/teacher/MySubjects'));
const TeacherGrades = React.lazy(() => import('./pages/teacher/Grades'));
const TeacherAnalytics = React.lazy(() => import('./pages/teacher/Analytics'));

// Student Pages
const StudentDashboard = React.lazy(() => import('./pages/student/Dashboard'));
const StudentSubjects = React.lazy(() => import('./pages/student/Subjects'));
const StudentGrades = React.lazy(() => import('./pages/student/Grades'));
const StudentAnalytics = React.lazy(() => import('./pages/student/Analytics'));

// Layouts
import { AuthLayout } from './components/layouts';

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
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
          <Route path="/admin/enrollment" element={<AdminEnrollment />} />
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
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
