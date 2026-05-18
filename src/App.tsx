import { useEffect, useState } from 'react';
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
import { ConfirmModal } from './components/ui';

// Auth Pages
import LoginPage from './pages/auth/Login';
import ChangePasswordPage from './pages/auth/ChangePassword';
import ForgotPasswordRedirect from './pages/auth/ForgotPassword';
import ResetPasswordPage from './pages/auth/ResetPassword';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsersPage from './pages/admin/Users';
import AdminCoursesPage from './pages/admin/Courses';
import AdminSubjectsPage from './pages/admin/Subjects';
import AdminAnalyticsPage from './pages/admin/Analytics';
import AdminGradesPage from './pages/admin/Grades';
import AdminAcademicPage from './pages/admin/Academic';
import AdminSectionsPage from './pages/admin/Sections';
import AdminAttendanceAccessPage from './pages/admin/AttendanceAccess';

// Teacher Pages
import TeacherDashboard from './pages/teacher/Dashboard';
import TeacherSubjectsPage from './pages/teacher/Subjects';
import TeacherGradesPage from './pages/teacher/Grades';
import TeacherStudentsPage from './pages/teacher/Students';
import TeacherAnalyticsPage from './pages/teacher/Analytics';
import TeacherAttendancePage from './pages/teacher/Attendance';

// Student Pages
import StudentDashboard from './pages/student/Dashboard';
import StudentSubjectsPage from './pages/student/Subjects';
import StudentGradesPage from './pages/student/Grades';
import StudentAnalyticsPage from './pages/student/Analytics';

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f5f5] via-[#e8e8e8] to-[#d4d4d4] px-6 py-10">
      <div
        className="mx-auto w-full max-w-lg space-y-4 pt-[12vh]"
        aria-busy="true"
        aria-label="Loading application"
      >
        <div className="h-10 animate-pulse rounded-xl bg-gray-300/65" />
        <div className="h-36 animate-pulse rounded-2xl border border-gray-300/40 bg-gray-200/70" />
        <div className="space-y-2.5 rounded-2xl border border-gray-300/35 bg-gray-100/75 p-4">
          <div className="h-3 animate-pulse rounded bg-gray-200/85" />
          <div className="h-3 w-[88%] animate-pulse rounded bg-gray-200/85" />
          <div className="h-3 w-[72%] animate-pulse rounded bg-gray-200/85" />
        </div>
        <div className="flex gap-3">
          <div className="h-11 flex-1 animate-pulse rounded-xl bg-gray-200/70" />
          <div className="h-11 w-24 animate-pulse rounded-xl bg-gray-200/60" />
        </div>
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

function RootRedirect() {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (user.role === 'teacher') return <Navigate to="/teacher/dashboard" replace />;
  if (user.role === 'student') return <Navigate to="/student/dashboard" replace />;
  return <Navigate to="/login" replace />;
}

function AppInitializer({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { setUser, setLoading, logout } = useAuthStore();
  const [warningOpen, setWarningOpen] = useState(false);
  const [warningRemainingMs, setWarningRemainingMs] = useState(0);

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
            const last = readLastActivity();
            if (Date.now() - last > INACTIVITY_MS) {
              await logout({ voluntary: true });
              clearActivityMarkers();
              navigate('/login', { replace: true, state: { sessionExpired: true, reason: 'inactivity' } });
              return;
            }
            touchLastActivity();
          } else {
            await supabase.auth.signOut();
          }
        } else {
          const raw = readUserProfileJson();
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as User;
              const last = readLastActivity();
              if (Date.now() - last > INACTIVITY_MS) {
                clearUserProfileEverywhere();
                clearActivityMarkers();
              } else {
                setUser({ ...parsed, password_hash: parsed.password_hash ?? '' });
                touchLastActivity();
              }
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
        if (path === '/login' || path === '/change-password' || path === '/forgot-password' || path === '/reset-password') return;
        if (consumeVoluntaryLogoutFlag()) return;
        navigate('/login', { replace: true, state: { sessionExpired: true, reason: 'auth' } });
        return;
      }

      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        touchLastActivity();
        const current = useAuthStore.getState().user;
        const sessionUserSwitched =
          event === 'TOKEN_REFRESHED' && (!current || current.id !== session.user.id);
        if (event === 'SIGNED_IN' || sessionUserSwitched) {
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
            if (path !== '/login' && path !== '/change-password' && path !== '/forgot-password' && path !== '/reset-password') {
              window.location.assign(`${window.location.origin}/login`);
            }
          }
        } catch {
          /* ignore */
        }
        return;
      }

      if (e.key === SAPAS_USER_KEY) {
        if (e.newValue === null) {
          void supabase.auth.signOut();
          clearActivityMarkers();
          useAuthStore.setState({ user: null });
          const path = window.location.pathname;
          if (path !== '/login' && path !== '/change-password' && path !== '/forgot-password' && path !== '/reset-password') {
            window.location.assign(`${window.location.origin}/login`);
          }
          return;
        }

        try {
          const parsed = JSON.parse(e.newValue) as User;
          const nextUser = { ...parsed, password_hash: parsed.password_hash ?? '' };
          setUser(nextUser);
          touchLastActivity();
          const path = window.location.pathname;
          const onAuthScreen =
            path === '/login' ||
            path === '/change-password' ||
            path === '/forgot-password' ||
            path === '/reset-password';
          if (onAuthScreen) return;
          const home =
            nextUser.role === 'admin'
              ? '/admin/dashboard'
              : nextUser.role === 'teacher'
                ? '/teacher/dashboard'
                : nextUser.role === 'student'
                  ? '/student/dashboard'
                  : '/login';
          if (home !== '/login' && !path.startsWith(`/${nextUser.role}`)) {
            navigate(home, { replace: true });
          }
        } catch {
          /* ignore malformed payload */
        }
      }
    };

    window.addEventListener('storage', onStorage);

    const WARNING_BEFORE_MS = 5 * 60 * 1000;
    const checkInactivity = () => {
      const path = window.location.pathname;
      if (path === '/login' || path === '/change-password' || path === '/forgot-password' || path === '/reset-password') return;
      const u = useAuthStore.getState().user;
      if (!u) return;
      const last = readLastActivity();
      const elapsed = Date.now() - last;
      const remaining = Math.max(0, INACTIVITY_MS - elapsed);
      if (elapsed > INACTIVITY_MS) {
        void (async () => {
          await logout({ voluntary: true });
          clearActivityMarkers();
          navigate('/login', { replace: true, state: { sessionExpired: true, reason: 'inactivity' } });
        })();
        setWarningOpen(false);
        setWarningRemainingMs(0);
        return;
      }
      if (remaining <= WARNING_BEFORE_MS) {
        setWarningOpen(true);
        setWarningRemainingMs(remaining);
      } else {
        setWarningOpen(false);
        setWarningRemainingMs(0);
      }
    };

    const interval = window.setInterval(checkInactivity, 1_000);

    const bumpActivity = () => {
      if (useAuthStore.getState().user) {
        touchLastActivity();
        setWarningOpen(false);
        setWarningRemainingMs(0);
      }
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

  const remainingMinutes = Math.floor(warningRemainingMs / 60_000);
  const remainingSeconds = Math.floor((warningRemainingMs % 60_000) / 1_000);

  return (
    <>
      {children}
      <ConfirmModal
        isOpen={warningOpen}
        onClose={() => setWarningOpen(false)}
        onConfirm={() => {
          touchLastActivity();
          setWarningOpen(false);
          setWarningRemainingMs(0);
        }}
        title="Session timeout warning"
        message={`Your session will expire due to inactivity in ${remainingMinutes}:${String(remainingSeconds).padStart(2, '0')}. Select "Stay signed in" to continue your session.`}
        confirmText="Stay signed in"
        cancelText="Dismiss"
        variant="warning"
      />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInitializer>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordRedirect />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Routes>
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="grades" element={<AdminGradesPage />} />
                  <Route path="users" element={<AdminUsersPage />} />
                  <Route path="courses" element={<AdminCoursesPage />} />
                  <Route path="subjects" element={<AdminSubjectsPage />} />
                  <Route path="attendance-access" element={<AdminAttendanceAccessPage />} />
                  <Route path="analytics" element={<AdminAnalyticsPage />} />
                  <Route path="academic" element={<AdminAcademicPage />} />
                  <Route path="sections" element={<AdminSectionsPage />} />
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
                  <Route path="attendance" element={<TeacherAttendancePage />} />
                  <Route path="analytics" element={<TeacherAnalyticsPage />} />
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

          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AppInitializer>
    </BrowserRouter>
  );
}
