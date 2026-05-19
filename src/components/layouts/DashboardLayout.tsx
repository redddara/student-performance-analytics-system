import { useEffect, useState, useMemo, type ReactNode, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  BookUser,
  Calendar,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  UserPen,
  Users,
  UserRound,
  ShieldCheck,
  MessageSquareWarning,
} from 'lucide-react';
import { useAuthStore } from '../../store';
import { supabase } from '../../lib/supabase';
import { formatPersonDisplayName } from '../../lib/personName';
import { useSupabaseLiveReload } from '../../lib/useSupabaseLiveReload';
import {
  buildTeacherDeadlineNotifications,
  fetchGradingPeriodDeadlines,
  type TeacherDeadlineNotification,
} from '../../lib/gradingPeriodDeadlines';
import {
  acknowledgeDisputeResolution,
  acknowledgeDisputeResolutions,
  buildStudentDisputeNotifications,
  buildTeacherDisputeNotifications,
  disputeResolutionNotificationId,
  fetchStudentDisputes,
  fetchTeacherDisputes,
  type DisputeNotification,
} from '../../lib/gradeDisputes';
import {
  computeUnreadNotifications,
  loadReadNotificationIds,
  saveReadNotificationIds,
} from '../../lib/notificationReadState';
import { getOnboardingStepsForRole } from '../../lib/onboardingTourSteps';
import {
  loadTourCompleted,
  saveTourCompleted,
  tourCompletedStorageKey,
} from '../../lib/tourCompletedState';
import { OnboardingTour } from '../onboarding/OnboardingTour';
import logoSpas from '../../assets/LOGO SPAS.png';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
}

type NavIcon = typeof LayoutDashboard;

const menuItems: Record<
  'admin' | 'teacher' | 'student',
  { id: string; label: string; Icon: NavIcon }[]
> = {
  admin: [
    { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { id: 'grades', label: 'Grades', Icon: UserPen },
    { id: 'users', label: 'Users', Icon: Users },
    { id: 'courses', label: 'Courses', Icon: BookUser },
    { id: 'subjects', label: 'Subjects', Icon: GraduationCap },
    { id: 'attendance-access', label: 'Attendance Access', Icon: ShieldCheck },
    { id: 'sections', label: 'Sections', Icon: Network },
    { id: 'academic', label: 'Academic', Icon: Calendar },
    { id: 'analytics', label: 'Analytics', Icon: BarChart3 },
  ],
  teacher: [
    { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { id: 'subjects', label: 'My Subjects', Icon: GraduationCap },
    { id: 'grades', label: 'Grades', Icon: UserPen },
    { id: 'disputes', label: 'Disputes', Icon: MessageSquareWarning },
    { id: 'students', label: 'Students', Icon: UserRound },
    { id: 'attendance', label: 'Attendance', Icon: Calendar },
    { id: 'analytics', label: 'Analytics', Icon: BarChart3 },
  ],
  student: [
    { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { id: 'subjects', label: 'My Subjects', Icon: GraduationCap },
    { id: 'schedule', label: 'My Schedule', Icon: Calendar },
    { id: 'grades', label: 'My Grades', Icon: UserPen },
    { id: 'analytics', label: 'Analytics', Icon: BarChart3 },
  ],
};

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeAnnouncements, setActiveAnnouncements] = useState<any[]>([]);
  const [adminWorkflowAlerts, setAdminWorkflowAlerts] = useState<any[]>([]);
  const [teacherDeadlineAlerts, setTeacherDeadlineAlerts] = useState<TeacherDeadlineNotification[]>([]);
  const [disputeAlerts, setDisputeAlerts] = useState<DisputeNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [onboardingTourOpen, setOnboardingTourOpen] = useState(false);
  const readNotificationsHydratedRef = useRef(false);
  const reloadAdminWorkflowTimerRef = useRef<number | null>(null);
  const onboardingTourCheckedRef = useRef(false);

  const role = user?.role || 'admin';
  const items = menuItems[role as keyof typeof menuItems] || menuItems.admin;

  const currentPage = location.pathname.split('/')[2] || 'dashboard';

  const handleLogout = async () => {
    await logout({ voluntary: true });
    navigate('/login');
  };

  const notificationsStorageKey = `sapas_read_notifications_${user?.id || 'guest'}_${role}`;
  const onboardingSteps = getOnboardingStepsForRole(role);
  const tourStorageKey =
    user?.id && onboardingSteps
      ? tourCompletedStorageKey(user.id, role)
      : null;

  useEffect(() => {
    onboardingTourCheckedRef.current = false;
    setOnboardingTourOpen(false);
  }, [tourStorageKey]);

  useEffect(() => {
    if (onboardingTourCheckedRef.current) return;
    if (!user?.id || !onboardingSteps || !tourStorageKey) return;
    if (user.is_temp_password) return;
    if (loadTourCompleted(tourStorageKey)) return;

    onboardingTourCheckedRef.current = true;
    const delay = window.setTimeout(() => setOnboardingTourOpen(true), 600);
    return () => window.clearTimeout(delay);
  }, [user?.id, user?.is_temp_password, onboardingSteps, tourStorageKey]);

  const completeOnboardingTour = useCallback(() => {
    if (tourStorageKey) saveTourCompleted(tourStorageKey);
    setOnboardingTourOpen(false);
    setSidebarOpen(false);
  }, [tourStorageKey]);

  const loadAnnouncements = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('system_announcements')
        .select('id,title,body,expires_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(2);
      if (error) throw error;
      const now = Date.now();
      setActiveAnnouncements(
        (data || []).filter((a: any) => !a.expires_at || new Date(a.expires_at).getTime() > now)
      );
    } catch {
      // Backward-compat: if migration not applied yet, keep dashboards working.
      setActiveAnnouncements([]);
    }
  }, []);

  useSupabaseLiveReload(
    loadAnnouncements,
    user?.id ? `live:layout-announcements:${user.id}` : null,
    ['system_announcements']
  );

  const loadTeacherDeadlineAlerts = useCallback(async () => {
    try {
      const { data: sy, error: syError } = await supabase
        .from('school_years')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();
      if (syError) throw syError;
      if (!sy?.id) {
        setTeacherDeadlineAlerts([]);
        return;
      }
      const deadlines = await fetchGradingPeriodDeadlines(sy.id);
      setTeacherDeadlineAlerts(buildTeacherDeadlineNotifications(deadlines));
    } catch {
      setTeacherDeadlineAlerts([]);
    }
  }, []);

  useEffect(() => {
    if (role !== 'teacher') {
      setTeacherDeadlineAlerts([]);
      return;
    }
    void loadTeacherDeadlineAlerts();
  }, [role, loadTeacherDeadlineAlerts]);

  useSupabaseLiveReload(
    loadTeacherDeadlineAlerts,
    role === 'teacher' && user?.id ? `live:layout-teacher-deadlines:${user.id}` : null,
    ['grading_period_deadlines', 'school_years']
  );

  const loadDisputeAlerts = useCallback(async () => {
    if (!user?.id) {
      setDisputeAlerts([]);
      return;
    }
    try {
      if (role === 'teacher') {
        const disputes = await fetchTeacherDisputes(user.id);
        setDisputeAlerts(buildTeacherDisputeNotifications(disputes));
        return;
      }
      if (role === 'student') {
        const { data: student, error } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (error) throw error;
        if (!student?.id) {
          setDisputeAlerts([]);
          return;
        }
        const disputes = await fetchStudentDisputes(student.id);
        setDisputeAlerts(buildStudentDisputeNotifications(disputes));
        const seenNotificationIds = disputes
          .filter(
            (d) =>
              d.resolution_seen_at &&
              (d.status === 'accepted' || d.status === 'rejected')
          )
          .map((d) => disputeResolutionNotificationId(d.id, d.status));
        if (seenNotificationIds.length) {
          setReadNotificationIds((prev) =>
            Array.from(new Set([...prev, ...seenNotificationIds]))
          );
        }
        return;
      }
      setDisputeAlerts([]);
    } catch {
      setDisputeAlerts([]);
    }
  }, [role, user?.id]);

  useEffect(() => {
    if (role !== 'teacher' && role !== 'student') {
      setDisputeAlerts([]);
      return;
    }
    void loadDisputeAlerts();
  }, [role, loadDisputeAlerts]);

  useSupabaseLiveReload(
    loadDisputeAlerts,
    (role === 'teacher' || role === 'student') && user?.id
      ? `live:layout-disputes:${role}:${user.id}`
      : null,
    ['grade_disputes', 'grades']
  );

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  useEffect(() => {
    readNotificationsHydratedRef.current = false;
    setReadNotificationIds(loadReadNotificationIds(notificationsStorageKey));
    readNotificationsHydratedRef.current = true;
  }, [notificationsStorageKey]);

  useEffect(() => {
    if (!readNotificationsHydratedRef.current) return;
    saveReadNotificationIds(notificationsStorageKey, readNotificationIds);
  }, [notificationsStorageKey, readNotificationIds]);

  const loadAdminWorkflowAlerts = useCallback(async () => {
    try {
      const [gradesRes, accessRes] = await Promise.all([
        supabase
          .from('grades')
          .select(
            'id,subject_id,semester,quarter,workflow_status,unlock_requested,unlock_reason,unlock_requested_at,created_at,subject:subjects(name,teacher:users(first_name,last_name,name))'
          )
          .or('unlock_requested.eq.true,workflow_status.eq.for_review'),
        supabase
          .from('attendance_access_requests')
          .select(
            'id, attendance_date, reason, created_at, subject:subjects(name, teacher:users(first_name, last_name, name))'
          )
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (gradesRes.error) throw gradesRes.error;
      const data = gradesRes.data;
      const grouped = new Map<string, any>();
      (data || []).forEach((row: any) => {
        const teacherName = formatPersonDisplayName(row?.subject?.teacher || {}) || 'Teacher';
        const kind = row.unlock_requested ? 'unlock' : 'review';
        const groupKey = `${kind}:${row.subject_id}:${row.semester}:${teacherName}`;
        const existing = grouped.get(groupKey) || {
          kind,
          subjectId: row.subject_id,
          subjectName: row?.subject?.name || 'Subject',
          semester: row.semester,
          teacherName,
          quarters: new Set<number>(),
          latestCreatedAt: row.created_at || '',
          latestUnlockReason: row.unlock_reason || '',
        };
        existing.quarters.add(Number(row.quarter));
        if ((row.created_at || '') > existing.latestCreatedAt) existing.latestCreatedAt = row.created_at || '';
        if (row.unlock_reason && String(row.unlock_reason).trim()) {
          existing.latestUnlockReason = String(row.unlock_reason).trim();
        }
        grouped.set(groupKey, existing);
      });
      const gradeAlerts = Array.from(grouped.values()).map((g: any) => {
        const quarterList = Array.from(g.quarters)
          .sort((a: number, b: number) => a - b)
          .map((q: number) => `Q${q}`)
          .join(', ');
        return {
          id: `wf:${g.kind}:${g.subjectId}:${g.semester}`,
          kind: g.kind,
          title: g.kind === 'unlock' ? `${g.teacherName} requested unlock` : `${g.teacherName} submitted for review`,
          body:
            g.kind === 'unlock' && g.latestUnlockReason
              ? `${g.subjectName} · Sem ${g.semester} · ${quarterList} · Reason: ${g.latestUnlockReason}`
              : `${g.subjectName} · Sem ${g.semester} · ${quarterList}`,
          actionPath: `/admin/grades?subject=${encodeURIComponent(g.subjectId)}&semester=${encodeURIComponent(String(g.semester))}`,
        };
      });

      const accessAlerts = (accessRes.data || []).map((row: any) => {
        const teacherName = formatPersonDisplayName(row?.subject?.teacher || {}) || 'Teacher';
        return {
          id: `att-access:${row.id}`,
          kind: 'attendance_access',
          title: `${teacherName} requested attendance access`,
          body: `${row?.subject?.name || 'Subject'} · ${row.attendance_date} · ${row.reason || 'No reason'}`,
          actionPath: '/admin/attendance-access',
        };
      });

      setAdminWorkflowAlerts([...accessAlerts, ...gradeAlerts]);
    } catch {
      setAdminWorkflowAlerts([]);
    }
  }, []);

  useEffect(() => {
    if (role !== 'admin') {
      setAdminWorkflowAlerts([]);
      return;
    }
    void loadAdminWorkflowAlerts();
  }, [role, loadAdminWorkflowAlerts]);

  useEffect(() => {
    if (role !== 'admin') return;

    const scheduleReload = () => {
      if (reloadAdminWorkflowTimerRef.current != null) {
        window.clearTimeout(reloadAdminWorkflowTimerRef.current);
      }
      reloadAdminWorkflowTimerRef.current = window.setTimeout(() => {
        reloadAdminWorkflowTimerRef.current = null;
        void loadAdminWorkflowAlerts();
      }, 80);
    };

    const channel = supabase
      .channel(`admin-workflow-alerts:${user?.id ?? 'unknown'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grades' }, () => scheduleReload())
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_access_requests' },
        () => scheduleReload()
      )
      .subscribe();

    return () => {
      if (reloadAdminWorkflowTimerRef.current != null) {
        window.clearTimeout(reloadAdminWorkflowTimerRef.current);
        reloadAdminWorkflowTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [role, user?.id, loadAdminWorkflowAlerts]);

  useEffect(() => {
    if (role !== 'admin') return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadAdminWorkflowAlerts();
    }, 2000);
    return () => window.clearInterval(id);
  }, [role, loadAdminWorkflowAlerts]);

  type LayoutNotification = {
    id: string;
    title: string;
    body: string;
    actionPath?: string;
    kind?: string;
    disputeId?: string;
  };

  const allNotifications = useMemo((): LayoutNotification[] => {
    const announcementNotifications: LayoutNotification[] = activeAnnouncements.map((ann: any) => ({
      id: `ann:${ann.id}`,
      title: ann.title,
      body: ann.body,
    }));
    if (role === 'admin') {
      return [...adminWorkflowAlerts, ...announcementNotifications];
    }
    if (role === 'teacher') {
      return [...disputeAlerts, ...teacherDeadlineAlerts, ...announcementNotifications];
    }
    if (role === 'student') {
      return [...disputeAlerts, ...announcementNotifications];
    }
    return announcementNotifications;
  }, [
    role,
    adminWorkflowAlerts,
    disputeAlerts,
    teacherDeadlineAlerts,
    activeAnnouncements,
  ]);

  const unreadNotifications = useMemo(
    () => computeUnreadNotifications(allNotifications, readNotificationIds),
    [allNotifications, readNotificationIds]
  );

  const persistDisputeAcknowledgements = (items: LayoutNotification[]) => {
    const disputeIds = items
      .filter((n) => n.kind === 'dispute_resolved' && n.disputeId)
      .map((n) => n.disputeId as string);
    if (!disputeIds.length) return;
    void acknowledgeDisputeResolutions(disputeIds).then(() => {
      void loadDisputeAlerts();
    });
  };

  const markAsRead = (id: string, item?: LayoutNotification) => {
    setReadNotificationIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    if (item?.kind === 'dispute_resolved' && item.disputeId) {
      void acknowledgeDisputeResolution(item.disputeId).then(() => {
        void loadDisputeAlerts();
      });
    }
  };

  const markAllVisibleAsRead = () => {
    const ids = unreadNotifications.map((n) => n.id);
    setReadNotificationIds((prev) => Array.from(new Set([...prev, ...ids])));
    persistDisputeAcknowledgements(unreadNotifications);
  };

  return (
    <div className="relative flex h-dvh overflow-hidden bg-white print:h-auto print:overflow-visible">

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm touch-manipulation md:hidden print:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside className={`z-40 w-[min(100%,16rem)] max-w-[85vw] maroon-sidebar flex flex-col fixed top-0 left-0 h-dvh min-h-screen pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] transition-transform duration-300 print:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Logo */}
        <div className="mb-6 px-3 pt-6 sm:px-4">
          <div className="flex items-center gap-3">
            <img
              src={logoSpas}
              className="h-14 w-14 shrink-0 object-contain drop-shadow-lg"
              width={56}
              height={56}
              alt="PHILTECH Student Performance Analytics System"
              decoding="async"
            />
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-tight text-maroon-100">PHILTECH</h1>
              <p className="text-xs leading-snug text-maroon-200/95">Student Performance Analytics System</p>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="mx-4 mb-4 p-4 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/30 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-maroon-600 via-maroon-500 to-maroon-700 flex items-center justify-center text-white font-bold shadow-md">
              {user?.name?.[0] || user?.first_name?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-maroon-100 truncate">
                {formatPersonDisplayName(user || {}) || 'User'}
              </p>
              <p className="text-xs text-maroon-200 capitalize">{role}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {items.map(item => {
            const Icon = item.Icon;
            return (
            <Link
              key={item.id}
              to={`/${role}/${item.id}`}
              data-tour={`nav-${item.id}`}
              className={`flex min-h-[44px] items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 touch-manipulation group ${
                currentPage === item.id
                  ? 'bg-gold-500/20 backdrop-blur-sm border border-gold-400/55 text-gold-100 shadow-lg gold-glow'
                  : 'text-maroon-200/90 hover:bg-white/10 hover:text-gold-200/90 hover:shadow-md'
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              <span className="font-medium">{item.label}</span>
            </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="mx-4 mb-6 pt-4 border-t border-white/30">
<button 
            type="button"
            className="flex min-h-[44px] items-center gap-3 px-4 py-3 w-full rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-lg hover:bg-white/20 hover:shadow-2xl hover:border-white/40 transition-all duration-300 hover:maroon-glow text-maroon-200 touch-manipulation"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="relative z-10 min-w-0 flex-1 h-dvh overflow-y-auto px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 md:ml-64 md:w-[calc(100%-16rem)] md:px-8 lg:px-12 md:pt-6 lg:pt-8 bg-white print:ml-0 print:h-auto print:w-full print:max-w-none print:overflow-visible print:p-0 print:pt-0">
        {/* Mobile Header with Hamburger */}
        <header
          className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between md:mb-10 print:hidden"
          data-tour="page-header"
        >
          <div className="flex items-start gap-3 min-w-0">
            <button 
              type="button"
              className="md:hidden shrink-0 p-3 min-h-[44px] min-w-[44px] rounded-2xl bg-white border border-maroon-200/60 text-maroon-800 shadow-md hover:border-maroon-400/50 hover:shadow-lg transition-all duration-300 touch-manipulation flex items-center justify-center"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />
            </button>
            <div className="min-w-0 pt-0.5">
              <h1 className="text-xl sm:text-2xl md:text-4xl font-bold text-gray-800 bg-gradient-to-r from-maroon-800 to-maroon-600 bg-clip-text text-transparent drop-shadow-lg break-words">{title}</h1>
              <p className="text-gray-500 mt-1 text-sm sm:text-base font-medium truncate max-w-[85vw] sm:max-w-none md:hidden">Welcome, {user?.name || user?.first_name || 'User'}</p>
              <p className="text-gray-500 mt-1 hidden md:block font-medium">Welcome back, {user?.name || user?.first_name || 'User'}</p>
            </div>
          </div>
          <div className="relative flex items-center gap-2 sm:gap-4 self-stretch sm:self-auto">
            <button
              type="button"
              className="relative rounded-2xl border border-maroon-200/60 bg-white p-2.5 text-maroon-800 shadow-md transition-all duration-300 hover:border-maroon-400/50 hover:shadow-lg"
              aria-label="Notifications"
              data-tour="notifications"
              onClick={() => setNotificationsOpen((prev) => !prev)}
            >
              <Bell className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              {unreadNotifications.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                  {unreadNotifications.length > 9 ? '9+' : unreadNotifications.length}
                </span>
              )}
            </button>
            <div className="px-3 py-2 sm:px-5 rounded-2xl glass-card transition-all duration-300 hover:border-maroon-300/70 hover:shadow-md w-full sm:w-auto text-center sm:text-left">
              <span className="inline-flex items-center text-xs sm:text-sm text-maroon-800 font-medium whitespace-nowrap">
                <Calendar className="mr-1.5 h-4 w-4 shrink-0 text-maroon-600 sm:mr-2 sm:h-[1.1rem] sm:w-[1.1rem]" strokeWidth={2} aria-hidden />
                {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            {notificationsOpen && (
              <div className="absolute right-0 top-14 z-20 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900">Notifications</p>
                  {unreadNotifications.length > 0 && (
                    <button
                      type="button"
                      className="text-xs font-medium text-[#800000] hover:underline"
                      onClick={() => markAllVisibleAsRead()}
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {unreadNotifications.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-gray-500">No new notifications.</p>
                  ) : (
                    unreadNotifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          markAsRead(item.id, item);
                          setNotificationsOpen(false);
                          if (item.actionPath) navigate(item.actionPath);
                        }}
                        className="block w-full border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50 last:border-b-0"
                      >
                        <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                        <p className="mt-1 text-xs text-gray-600">{item.body}</p>
                        {item.kind === 'due_soon' && (
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                            Due soon
                          </p>
                        )}
                        {item.kind === 'passed' && (
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                            Locked
                          </p>
                        )}
                        {item.kind === 'dispute_pending' && (
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                            Grade dispute
                          </p>
                        )}
                        {item.kind === 'dispute_resolved' && (
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[#800000]">
                            Dispute update
                          </p>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Content — smooth transition when switching sidebar pages */}
        <div key={location.pathname} className="sapas-page-transition min-w-0">
          {children}
        </div>
      </main>

      {onboardingTourOpen && onboardingSteps && (
        <OnboardingTour
          steps={onboardingSteps}
          onComplete={completeOnboardingTour}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
      )}
    </div>
  );
}
