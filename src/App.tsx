import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';

// Auth Pages
import LoginPage from './pages/auth/Login';
import ChangePasswordPage from './pages/auth/ChangePassword';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsersPage from './pages/admin/Users';
import AdminCoursesPage from './pages/admin/Courses';
import AdminSubjectsPage from './pages/admin/Subjects';
import AdminAnalyticsPage from './pages/admin/Analytics';

// Teacher Pages
import TeacherDashboard from './pages/teacher/Dashboard';
import TeacherSubjectsPage from './pages/teacher/Subjects';
import TeacherGradesPage from './pages/teacher/Grades';
import TeacherStudentsPage from './pages/teacher/Students';
import TeacherAnalyticsPage from './pages/teacher/Analytics';
import TeacherUploadPage from './pages/teacher/Upload';

// Student Pages
import StudentDashboard from './pages/student/Dashboard';
import StudentSubjectsPage from './pages/student/Subjects';
import StudentGradesPage from './pages/student/Grades';
import StudentAnalyticsPage from './pages/student/Analytics';

// Loading Spinner
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f5f5f5] via-[#e8e8e8] to-[#d4d4d4]">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-[#800000]/30 border-t-[#800000] animate-spin" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

// Protected Route Component
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, isLoading } = useAuthStore();
  
  if (isLoading) return <LoadingScreen />;
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard based on role
    if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'teacher') return <Navigate to="/teacher/dashboard" replace />;
    if (user.role === 'student') return <Navigate to="/student/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

// App Initializer
function AppInitializer({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore();
  
  useEffect(() => {
    // Check current session
    const checkSession = async () => {
      try {
        // For demo, we'll check localStorage
        const savedUser = localStorage.getItem('sapas_user');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          setUser(parsed);
        }
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setLoading(false);
      }
    };
    
    checkSession();
  }, []);
  
  return <>{children}</>;
}

// Main App
export default function App() {
  return (
    <BrowserRouter>
      <AppInitializer>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          
          {/* Admin Routes */}
          <Route path="/admin/*" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Routes>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="courses" element={<AdminCoursesPage />} />
                <Route path="subjects" element={<AdminSubjectsPage />} />
                <Route path="analytics" element={<AdminAnalyticsPage />} />
                <Route path="*" element={<Navigate to="dashboard" replace />} />
              </Routes>
            </ProtectedRoute>
          } />
          
          {/* Teacher Routes */}
          <Route path="/teacher/*" element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <Routes>
                <Route path="dashboard" element={<TeacherDashboard />} />
                <Route path="subjects" element={<TeacherSubjectsPage />} />
                <Route path="grades" element={<TeacherGradesPage />} />
                <Route path="students" element={<TeacherStudentsPage />} />
                <Route path="analytics" element={<TeacherAnalyticsPage />} />
                <Route path="upload" element={<TeacherUploadPage />} />
                <Route path="*" element={<Navigate to="dashboard" replace />} />
              </Routes>
            </ProtectedRoute>
          } />
          
          {/* Student Routes */}
          <Route path="/student/*" element={
            <ProtectedRoute allowedRoles={['student']}>
              <Routes>
                <Route path="dashboard" element={<StudentDashboard />} />
                <Route path="subjects" element={<StudentSubjectsPage />} />
                <Route path="grades" element={<StudentGradesPage />} />
                <Route path="analytics" element={<StudentAnalyticsPage />} />
                <Route path="*" element={<Navigate to="dashboard" replace />} />
              </Routes>
            </ProtectedRoute>
          } />
          
          {/* Default Redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AppInitializer>
    </BrowserRouter>
  );
}
