import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store';
import { supabase } from './lib/supabase';
import { fetchUserProfileByAuthId, fetchUserProfileByEmail } from './lib/authProfile';
import {
  clearActivityMarkers,
  clearUserProfileEverywhere,
  consumeVoluntaryLogoutFlag,
  readLastActivity,
  readUserProfileJson,
  touchLastActivity,
} from './lib/profileStorage';
import {
  INACTIVITY_MS,
  SAPAS_TAB_SYNC_KEY,
  SAPAS_USER_KEY,
} from './lib/sessionConstants';
import type { TabSyncPayload } from './lib/sessionConstants';
import type { User } from './types';

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

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, isLoading } = useAuthStore();

  if (isLoading) return <LoadingScreen />;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'teacher') return <Navigate to="/teacher/dashboard" replace />;
    if (user.role === 'student') return <Navigate to="/student/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppInitializer({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { setUser, setLoading, logout } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;

        if (session?.user) {
          let profile = await fetchUserProfileByAuthId(session.user.id);
          if (!profile && session.user.email) {
            profile = await fetchUserProfileByEmail(session.user.email);
          }
          if (profile) {
            setUser(profile);
            touchLastActivity();
          } else {
            await supabase.auth.signOut();
          }
        } else {
          const raw = readUserProfileJson();
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as User;
              setUser({ ...parsed, password_hash: parsed.password_hash ?? '' });
              touchLastActivity();
            } catch {
              clearUserProfileEverywhere();
            }
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void hydrate();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled || event === 'INITIAL_SESSION') return;

      if (event === 'SIGNED_OUT') {
        clearUserProfileEverywhere();
        clearActivityMarkers();
        useAuthStore.setState({ user: null });
        const path = window.location.pathname;
        if (path === '/login' || path === '/change-password') return;
        if (consumeVoluntaryLogoutFlag()) return;
        navigate('/login', { replace: true, state: { sessionExpired: true, reason: 'auth' } });
        return;
      }

      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        touchLastActivity();
        if (event === 'SIGNED_IN') {
          let profile = await fetchUserProfileByAuthId(session.user.id);
          if (!profile && session.user.email) {
            profile = await fetchUserProfileByEmail(session.user.email);
          }
          if (profile) {
            setUser(profile);
          }
        }
      }
    });

    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage && e.storageArea !== sessionStorage) return;

      if (e.key === SAPAS_TAB_SYNC_KEY && e.newValue) {
        try {
          const p = JSON.parse(e.newValue) as TabSyncPayload;
          if (p.type === 'logout') {
            void supabase.auth.signOut();
            clearUserProfileEverywhere();
            clearActivityMarkers();
            useAuthStore.setState({ user: null });
            const path = window.location.pathname;
            if (path !== '/login' && path !== '/change-password') {
              window.location.assign(`${window.location.origin}/login`);
            }
          }
        } catch {
          /* ignore */
        }
        return;
      }

      if (e.key === SAPAS_USER_KEY && e.newValue === null) {
        void supabase.auth.signOut();
        clearActivityMarkers();
        useAuthStore.setState({ user: null });
        const path = window.location.pathname;
        if (path !== '/login' && path !== '/change-password') {
          window.location.assign(`${window.location.origin}/login`);
        }
      }
    };

    window.addEventListener('storage', onStorage);

    const checkInactivity = () => {
      const path = window.location.pathname;
      if (path === '/login' || path === '/change-password') return;
      const u = useAuthStore.getState().user;
      if (!u) return;
      const last = readLastActivity();
      if (Date.now() - last > INACTIVITY_MS) {
        void (async () => {
          await logout({ voluntary: true });
          clearActivityMarkers();
          navigate('/login', { replace: true, state: { sessionExpired: true, reason: 'inactivity' } });
        })();
      }
    };

    const interval = window.setInterval(checkInactivity, 60_000);

    const bumpActivity = () => {
      if (useAuthStore.getState().user) touchLastActivity();
    };
    window.addEventListener('mousedown', bumpActivity);
    window.addEventListener('keydown', bumpActivity);
    window.addEventListener('scroll', bumpActivity, { passive: true });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('mousedown', bumpActivity);
      window.removeEventListener('keydown', bumpActivity);
      window.removeEventListener('scroll', bumpActivity);
      window.clearInterval(interval);
    };
  }, [navigate, setUser, setLoading, logout]);

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInitializer>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />

          <Route
            path="/admin/*"
            element={
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
            }
          />

          <Route
            path="/teacher/*"
            element={
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
            }
          />

          <Route
            path="/student/*"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <Routes>
                  <Route path="dashboard" element={<StudentDashboard />} />
                  <Route path="subjects" element={<StudentSubjectsPage />} />
                  <Route path="grades" element={<StudentGradesPage />} />
                  <Route path="analytics" element={<StudentAnalyticsPage />} />
                  <Route path="*" element={<Navigate to="dashboard" replace />} />
                </Routes>
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AppInitializer>
    </BrowserRouter>
  );
}
