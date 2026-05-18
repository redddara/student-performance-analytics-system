import { useState, useEffect, useMemo } from 'react';
import {
  ListFilter,
  LockOpen,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Upload,
  Download,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageIntro } from '../../components/layouts/PageIntro';
import {
  GlassCard,
  Button,
  Input,
  Table,
  Modal,
  Spinner,
  PageSkeletonLoader,
  Badge,
  Select,
  ConfirmModal,
  MessageModal,
  type AppMessagePayload,
} from '../../components/ui';
import {
  supabase,
  hashPassword,
  generateTempPassword,
  generateStudentUsername,
  createStudentUsernameAllocator,
  getNextStudentUsernameSequence,
  studentUsernameLikePattern,
} from '../../lib/supabase';
import { sendEmail, generateStudentCredentialEmail, generatePasswordResetEmail } from '../../api/email';
import {
  DEFAULT_SCHOOL_SECTION,
  type SchoolSectionCode,
  normalizeSchoolSection,
  sectionFromUserRecord,
} from '../../constants/schoolSections';
import {
  fetchActiveOfficialSections,
  matchesOfficialSectionFilter,
  officialSectionFilterOptions,
  sectionsForStudentFilter,
  type OfficialSection,
} from '../../lib/officialSections';
import { isLoginLocked } from '../../lib/loginLock';
import {
  formatPersonDisplayName,
  normalizePersonNames,
  normalizeTeacherTitle,
  TEACHER_TITLE_SELECT_OPTIONS,
} from '../../lib/personName';
import {
  courseSelectOptions,
  sectionSelectOptions,
  sortByName,
  sortByStudentName,
  sortSelectOptions,
} from '../../lib/sortUtils';

type OfficialSectionRow = {
  id: string;
  name: string;
  course_id: string | null;
  year_level: string | null;
  section_code: string | null;
  is_active: boolean;
};

export default function AdminUsersPage() {
  // const { setStudents } = useDataStore();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkCreateModal, setShowBulkCreateModal] = useState(false);
  const [showBulkTeachersModal, setShowBulkTeachersModal] = useState(false);
  const [createType, setCreateType] = useState<'student' | 'teacher' | 'admin'>('student');
  const [courses, setCourses] = useState<any[]>([]);

  const [filterSearch, setFilterSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterCourseId, setFilterCourseId] = useState('');
  const [filterYearLevel, setFilterYearLevel] = useState('');
  const [filterTempStatus, setFilterTempStatus] = useState('');
  const [filterAccountStatus, setFilterAccountStatus] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [officialSections, setOfficialSections] = useState<OfficialSection[]>([]);
  const [studentSectionByUserId, setStudentSectionByUserId] = useState<Map<string, string>>(new Map());
  const [rowActionKey, setRowActionKey] = useState<string | null>(null);
  const [usersTablePage, setUsersTablePage] = useState(1);
  const [usersTablePageSize, setUsersTablePageSize] = useState(10);

  // Confirmation modal states
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'delete' | 'reset' | null;
    userId: string | null;
    userName: string | null;
  }>({ isOpen: false, type: null, userId: null, userName: null });

  const [appMessage, setAppMessage] = useState<AppMessagePayload | null>(null);
  const showMessage = (payload: AppMessagePayload) => setAppMessage(payload);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersRes, coursesRes, sectionsRes, studentsRes] = await Promise.all([
        supabase.from('users').select('*').order('created_at', { ascending: false }),
        supabase.from('courses').select('*').order('name', { ascending: true }),
        fetchActiveOfficialSections(),
        supabase.from('students').select('user_id, section_id'),
      ]);

      setUsers(usersRes.data || []);
      setCourses(coursesRes.data || []);
      setOfficialSections(sectionsRes);
      const sectionMap = new Map<string, string>();
      (studentsRes.data || []).forEach((row: { user_id?: string | null; section_id?: string | null }) => {
        if (row.user_id) sectionMap.set(row.user_id, row.section_id || '');
      });
      setStudentSectionByUserId(sectionMap);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockLogin = async (userId: string) => {
    if (rowActionKey) return;
    setRowActionKey(`unlock:${userId}`);
    const { error } = await supabase
      .from('users')
      .update({ login_failed_attempts: 0, login_locked_until: null })
      .eq('id', userId);
    if (error) {
      showMessage({
        title: 'Could not unlock account',
        message: error.message || 'Check your connection and try again.',
        variant: 'error',
      });
      setRowActionKey(null);
      return;
    }
    showMessage({
      title: 'Login unlocked',
      message: 'This user can sign in again. Failed attempt count was reset.',
      variant: 'success',
    });
    loadData();
    setRowActionKey(null);
  };

  const handleToggleDropout = async (userId: string, makeDropout: boolean) => {
    if (rowActionKey) return;
    setRowActionKey(`dropout:${userId}`);
    const { error } = await supabase
      .from('users')
      .update({
        is_dropout: makeDropout,
        login_failed_attempts: 0,
        login_locked_until: null,
      })
      .eq('id', userId)
      .eq('role', 'student');

    if (error) {
      showMessage({
        title: 'Could not update account status',
        message: error.message || 'Check your connection and try again.',
        variant: 'error',
      });
      setRowActionKey(null);
      return;
    }

    showMessage({
      title: makeDropout ? 'Student marked as dropout' : 'Student reactivated',
      message: makeDropout
        ? 'This student account is now locked from signing in.'
        : 'This student account can sign in again.',
      variant: 'success',
    });
    loadData();
    setRowActionKey(null);
  };

  const handleResetPassword = async () => {
    if (!confirmModal.userId) return;
    
    // Get user data first
    const { data: user } = await supabase.from('users').select('*').eq('id', confirmModal.userId).single();
    if (!user) return;
    
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    
    await supabase
      .from('users')
      .update({ 
        password_hash: passwordHash,
        is_temp_password: true,
        temp_password_visible: tempPassword 
      })
      .eq('id', confirmModal.userId);

    let emailNote = user.email ? '' : 'No email on file for this user.';
    if (user.email) {
      const emailData = generatePasswordResetEmail(user.first_name || 'User', tempPassword);
      const sent = await sendEmail(user.email, emailData.subject, emailData.html);
      emailNote = sent.success
        ? `Notification sent to ${user.email}.`
        : `Email could not be sent (${sent.error ?? 'unknown error'}). Share the new password manually.`;
    }

    showMessage({
      title: 'Password reset',
      message: `Temporary password: ${tempPassword}\n\n${emailNote}`,
      variant: 'success',
    });
  };

  const handleDeleteUser = async () => {
    if (!confirmModal.userId) return;
    
    try {
      const { data: user } = await supabase.from('users').select('*').eq('id', confirmModal.userId).single();
      
      if (user?.role === 'student') {
        // First get the student record
        const { data: studentData } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', confirmModal.userId)
          .single();
        
        if (studentData?.id) {
          // Delete grades associated with the student
          await supabase.from('grades').delete().eq('student_id', studentData.id);
          // Delete student subject enrollments
          await supabase.from('student_subjects').delete().eq('student_id', studentData.id);
          // Delete the student record
          await supabase.from('students').delete().eq('user_id', confirmModal.userId);
        }
      }
      
      // Also clean up any subjects where this user was assigned as teacher
      await supabase.from('subjects').update({ teacher_id: null }).eq('teacher_id', confirmModal.userId);
      
      // Delete the user
      await supabase.from('users').delete().eq('id', confirmModal.userId);
      
      showMessage({ title: 'User deleted', message: 'The user has been removed from the system.', variant: 'success' });
      loadData();
    } catch (err: any) {
      showMessage({
        title: 'Could not delete user',
        message: err.message || 'Something went wrong. Try again.',
        variant: 'error',
      });
    }
  };

  const openConfirmModal = (type: 'delete' | 'reset', userId: string, userName: string) => {
    setConfirmModal({ isOpen: true, type, userId, userName });
  };

  const handleEditUser = async (userId: string, updatedData: any, role?: string) => {
    try {
      if (role === 'teacher' && !normalizeTeacherTitle(updatedData.name_title)) {
        showMessage({
          title: 'Title required',
          message: 'Select Mr., Mrs., or Ms. for the teacher.',
          variant: 'warning',
        });
        return;
      }

      const previousUser = users.find((u) => u.id === userId);
      let resolvedYearLevel = updatedData.year_level;
      let resolvedCourseId = updatedData.course_id || null;
      let resolvedLegacySection = updatedData.section;

      if (role === 'student' && updatedData.section_id) {
        const { data: sec, error: secErr } = await supabase
          .from('sections')
          .select('id,course_id,year_level,section_code,name,is_active')
          .eq('id', updatedData.section_id)
          .maybeSingle();
        if (secErr) throw secErr;
        if (sec) {
          resolvedYearLevel = sec.year_level || resolvedYearLevel;
          resolvedCourseId = sec.course_id || resolvedCourseId;
          resolvedLegacySection = (sec.section_code || sec.name || resolvedLegacySection || '').toString();
        }
      }

      const { first_name, last_name } = normalizePersonNames({
        first_name: updatedData.first_name,
        last_name: updatedData.last_name,
      });

      const payload: Record<string, unknown> = {
        first_name,
        last_name,
        email: updatedData.email,
        year_level: resolvedYearLevel,
        course_id: role === 'student' || role === 'teacher' ? resolvedCourseId : null,
        name_title: role === 'teacher' ? normalizeTeacherTitle(updatedData.name_title) || null : null,
      };
      if (role === 'student') {
        payload.section = resolvedLegacySection;
        payload.is_dropout = Boolean(updatedData.is_dropout);
      }
      await supabase.from('users').update(payload).eq('id', userId);

      if (role === 'student') {
        const { data: studentRow } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        await supabase
          .from('students')
          .update({
            first_name,
            last_name,
            section_id: updatedData.section_id || null,
            section: resolvedLegacySection,
            course_id: resolvedCourseId,
            grade_level: resolvedYearLevel || null,
          })
          .eq('user_id', userId);

        const courseChanged = (previousUser?.course_id || '') !== (resolvedCourseId || '');
        const yearChanged = (previousUser?.year_level || '') !== (resolvedYearLevel || '');
        if (studentRow?.id && (courseChanged || yearChanged)) {
          await supabase.from('student_subjects').delete().eq('student_id', studentRow.id);

          if (resolvedCourseId && resolvedYearLevel) {
            const { data: newSubjects } = await supabase
              .from('subjects')
              .select('id')
              .eq('course_id', resolvedCourseId)
              .eq('year_level', resolvedYearLevel);

            if (newSubjects && newSubjects.length > 0) {
              const newEnrollments = newSubjects.map((sub) => ({
                student_id: studentRow.id,
                subject_id: sub.id,
              }));
              await supabase
                .from('student_subjects')
                .upsert(newEnrollments, { onConflict: 'student_id,subject_id', ignoreDuplicates: true });
            }
          }
        }
      }

      loadData();
      showMessage({ title: 'Changes saved', message: 'User details were updated successfully.', variant: 'success' });
    } catch (err: any) {
      showMessage({
        title: 'Could not save changes',
        message: err.message || 'Something went wrong. Try again.',
        variant: 'error',
      });
    }
  };

  const sortedCourses = useMemo(() => sortByName(courses), [courses]);
  const courseFilterOptions = useMemo(() => courseSelectOptions(sortedCourses), [sortedCourses]);

  const sectionFilterOptions = useMemo(() => {
    const studentUsers = users.filter((u) => u.role === 'student');
    const studentsForFilter = studentUsers.map((u) => ({
      section_id: studentSectionByUserId.get(u.id) || null,
    }));
    return officialSectionFilterOptions(
      sectionsForStudentFilter(officialSections, studentsForFilter),
      'All sections'
    );
  }, [officialSections, users, studentSectionByUserId]);

  const filteredUsers = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    const filtered = users.filter((u) => {
      const displayName = formatPersonDisplayName(u).toLowerCase();
      const email = String(u.email || '').toLowerCase();
      const uname = String(u.username || '').toLowerCase();
      if (q && !displayName.includes(q) && !email.includes(q) && !uname.includes(q)) return false;
      if (filterRole && u.role !== filterRole) return false;
      if (filterCourseId && u.course_id !== filterCourseId) return false;
      if (filterYearLevel && (u.year_level || '') !== filterYearLevel) return false;
      if (filterTempStatus === 'temp' && !u.is_temp_password) return false;
      if (filterTempStatus === 'active' && u.is_temp_password) return false;
      if (filterAccountStatus === 'dropout' && !u.is_dropout) return false;
      if (filterAccountStatus === 'active' && (u.role !== 'student' || u.is_dropout)) return false;
      if (filterSection) {
        if (u.role !== 'student') return false;
        if (!matchesOfficialSectionFilter(studentSectionByUserId.get(u.id), filterSection)) return false;
      }
      return true;
    });
    return sortByStudentName(filtered);
  }, [users, filterSearch, filterRole, filterCourseId, filterYearLevel, filterTempStatus, filterAccountStatus, filterSection, studentSectionByUserId]);

  const hasActiveFilters =
    Boolean(filterSearch.trim()) ||
    Boolean(filterRole) ||
    Boolean(filterCourseId) ||
    Boolean(filterYearLevel) ||
    Boolean(filterTempStatus) ||
    Boolean(filterAccountStatus) ||
    Boolean(filterSection);

  const totalUserPages = useMemo(
    () => Math.max(1, Math.ceil(filteredUsers.length / usersTablePageSize)),
    [filteredUsers.length, usersTablePageSize]
  );

  const paginatedUsers = useMemo(() => {
    const start = (usersTablePage - 1) * usersTablePageSize;
    return filteredUsers.slice(start, start + usersTablePageSize);
  }, [filteredUsers, usersTablePage, usersTablePageSize]);

  useEffect(() => {
    setUsersTablePage(1);
  }, [
    filterSearch,
    filterRole,
    filterCourseId,
    filterYearLevel,
    filterTempStatus,
    filterAccountStatus,
    filterSection,
    usersTablePageSize,
  ]);

  useEffect(() => {
    setUsersTablePage((prev) => Math.min(prev, totalUserPages));
  }, [totalUserPages]);

  const clearFilters = () => {
    setFilterSearch('');
    setFilterRole('');
    setFilterCourseId('');
    setFilterYearLevel('');
    setFilterTempStatus('');
    setFilterAccountStatus('');
    setFilterSection('');
  };

  if (loading) {
    return (
      <DashboardLayout title="Users">
        <PageSkeletonLoader rows={8} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="User Management">
      <PageIntro
        title="Accounts directory"
      />
      <div className="mb-5 w-full max-w-2xl">
        <label htmlFor="user-search" className="sr-only">
          Search users
        </label>
        <div className="relative">
          <span
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-maroon-700/75"
            aria-hidden
          >
            <Search className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          </span>
          <input
            id="user-search"
            type="search"
            autoComplete="off"
            placeholder="Search by name, email, or student ID…"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="w-full rounded-2xl border border-white/70 bg-white/55 py-3.5 pl-12 pr-4 text-base text-gray-900 shadow-[0_8px_32px_rgba(128,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl placeholder:text-gray-500 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/35"
          />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button
          variant="glass"
          className="w-full sm:w-auto"
          onClick={() => {
            setCreateType('student');
            setShowCreateModal(true);
          }}
        >
          <UserPlus className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          Add Student
        </Button>
        <Button
          variant="glass"
          className="w-full sm:w-auto"
          onClick={() => {
            setCreateType('teacher');
            setShowCreateModal(true);
          }}
        >
          <UserPlus className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          Add Teacher
        </Button>
        <Button
          variant="glass"
          className="w-full sm:w-auto"
          onClick={() => {
            setCreateType('admin');
            setShowCreateModal(true);
          }}
        >
          <UserPlus className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          Add Admin
        </Button>
        <Button
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={() => setShowBulkCreateModal(true)}
        >
          <Upload className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          Bulk Add Students
        </Button>
        <Button
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={() => setShowBulkTeachersModal(true)}
        >
          <Upload className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          Bulk Add Teachers
        </Button>
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-maroon-200 bg-white text-[#800000] shadow-sm transition-colors hover:bg-maroon-50 touch-manipulation"
          aria-expanded={filtersOpen}
          aria-label={filtersOpen ? 'Hide user filters' : 'Show user filters'}
          title="Filters"
        >
          <ListFilter className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          {hasActiveFilters && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#d4af37] ring-2 ring-white" aria-hidden />
          )}
        </button>
        {!filtersOpen && (
          <span className="text-sm text-gray-600">
            Showing <span className="font-semibold text-[#800000]">{filteredUsers.length}</span>
            {' / '}
            {users.length} user{users.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {filtersOpen && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 animate-fade-in">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-[#800000]">Filter users</h2>
            {hasActiveFilters && (
              <Button type="button" variant="secondary" className="w-full shrink-0 sm:w-auto" onClick={clearFilters}>
                <RefreshCw className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                Clear filters
              </Button>
            )}
          </div>
          <p className="mb-4 text-sm text-gray-600">
            Use the search bar above to filter by name, email, or student ID. Choosing a section shows only
            students in that section (teachers and admins are hidden while a section is selected).
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              label="Role"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              options={[
                { value: '', label: 'All roles' },
                { value: 'admin', label: 'Admin' },
                { value: 'teacher', label: 'Teacher' },
                { value: 'student', label: 'Student' },
              ]}
            />
            <Select
              label="Course"
              value={filterCourseId}
              onChange={(e) => setFilterCourseId(e.target.value)}
              options={courseFilterOptions}
            />
            <Select
              label="Year level"
              value={filterYearLevel}
              onChange={(e) => setFilterYearLevel(e.target.value)}
              options={[
                { value: '', label: 'All years' },
                { value: '1st', label: '1st Year' },
                { value: '2nd', label: '2nd Year' },
                { value: '3rd', label: '3rd Year' },
                { value: '4th', label: '4th Year' },
              ]}
            />
            <Select
              label="Section (students)"
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
              options={sectionFilterOptions}
            />
            <Select
              label="Password status"
              value={filterTempStatus}
              onChange={(e) => setFilterTempStatus(e.target.value)}
              options={[
                { value: '', label: 'All' },
                { value: 'temp', label: 'Temporary password' },
                { value: 'active', label: 'Active (password changed)' },
              ]}
            />
            <Select
              label="Student account"
              value={filterAccountStatus}
              onChange={(e) => setFilterAccountStatus(e.target.value)}
              options={[
                { value: '', label: 'All students' },
                { value: 'active', label: 'Active students' },
                { value: 'dropout', label: 'Dropout (locked)' },
              ]}
            />
          </div>
          <p className="mt-4 text-sm text-gray-600">
            Showing <span className="font-semibold text-[#800000]">{filteredUsers.length}</span> of {users.length} user
            {users.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      <GlassCard className="p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-[#800000] mb-4">All Users</h2>
        <Table headers={['Name', 'Username', 'Role', 'Email', 'Status', 'Actions']}>
          {paginatedUsers.map((user) => (
            <tr key={user.id} className="hover:bg-white/20 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#800000] to-[#d4af37] flex items-center justify-center text-white text-sm font-bold">
                    {user.name?.[0] || user.first_name?.[0] || 'U'}
                  </div>
                  <span className="font-medium text-gray-800">
                    {formatPersonDisplayName(user)}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-600">{user.username || '-'}</td>
              <td className="px-4 py-3">
                <Badge variant={user.role === 'admin' ? 'danger' : user.role === 'teacher' ? 'warning' : 'success'}>
                  {user.role}
                </Badge>
              </td>
              <td className="px-4 py-3 text-gray-600">{user.email}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {user.is_temp_password && <Badge variant="warning">Temp</Badge>}
                  {user.role === 'student' && user.is_dropout && <Badge variant="danger">Dropout</Badge>}
                  {isLoginLocked(user) && <Badge variant="danger">Login locked</Badge>}
                  {!user.is_temp_password && !isLoginLocked(user) && !user.is_dropout && (
                    <span className="text-xs text-gray-500">—</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {user.role === 'student' && (
                    <button
                      type="button"
                      className={`p-2 rounded-lg glass-hover ${user.is_dropout ? 'text-green-700' : 'text-amber-700'}`}
                      onClick={() => handleToggleDropout(user.id, !user.is_dropout)}
                      disabled={Boolean(rowActionKey)}
                      title={user.is_dropout ? 'Reactivate student account' : 'Mark as dropout (lock account)'}
                      aria-label={
                        user.is_dropout
                          ? `Reactivate ${user.name || user.first_name || 'student'}`
                          : `Mark ${user.name || user.first_name || 'student'} as dropout`
                      }
                    >
                      {user.is_dropout ? (
                        rowActionKey === `dropout:${user.id}` ? (
                          <Spinner size="sm" />
                        ) : (
                          <UserCheck className="h-[1.15rem] w-[1.15rem] shrink-0" strokeWidth={2} aria-hidden />
                        )
                      ) : (
                        rowActionKey === `dropout:${user.id}` ? (
                          <Spinner size="sm" />
                        ) : (
                          <UserX className="h-[1.15rem] w-[1.15rem] shrink-0" strokeWidth={2} aria-hidden />
                        )
                      )}
                    </button>
                  )}
                  {isLoginLocked(user) && (
                    <button
                      type="button"
                      className="p-2 rounded-lg glass-hover text-green-700"
                      onClick={() => handleUnlockLogin(user.id)}
                      disabled={Boolean(rowActionKey)}
                      title="Unlock login (clear lockout)"
                      aria-label={`Unlock login for ${user.name || user.first_name || 'user'}`}
                    >
                      {rowActionKey === `unlock:${user.id}` ? (
                        <Spinner size="sm" />
                      ) : (
                        <LockOpen className="h-[1.15rem] w-[1.15rem] shrink-0" strokeWidth={2} aria-hidden />
                      )}
                    </button>
                  )}
                  <button 
                    type="button"
                    className="p-2 rounded-lg glass-hover text-[#800000]" 
                    onClick={() => openConfirmModal('reset', user.id, formatPersonDisplayName(user))}
                    title="Reset Password"
                  >
                    <RefreshCw className="h-[1.15rem] w-[1.15rem] shrink-0" strokeWidth={2} aria-hidden />
                  </button>
                  <EditUserModal user={user} courses={courses} onSave={handleEditUser} />
                  <button 
                    type="button"
                    className="p-2 rounded-lg glass-hover text-red-600" 
                    onClick={() => openConfirmModal('delete', user.id, formatPersonDisplayName(user))}
                    title="Delete User"
                  >
                    <Trash2 className="h-[1.15rem] w-[1.15rem] shrink-0" strokeWidth={2} aria-hidden />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
        {filteredUsers.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 border-t border-white/20 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-sm text-gray-100">
              <span>
                Showing{' '}
                <span className="font-semibold">
                  {(usersTablePage - 1) * usersTablePageSize + 1}
                </span>{' '}
                -{' '}
                <span className="font-semibold">
                  {Math.min(usersTablePage * usersTablePageSize, filteredUsers.length)}
                </span>{' '}
                of <span className="font-semibold">{filteredUsers.length}</span>
              </span>
              <Select
                label=""
                value={`${usersTablePageSize}`}
                onChange={(e) => setUsersTablePageSize(parseInt(e.target.value, 10))}
                options={[
                  { value: '10', label: '10 / page' },
                  { value: '25', label: '25 / page' },
                  { value: '50', label: '50 / page' },
                ]}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                disabled={usersTablePage <= 1}
                onClick={() => setUsersTablePage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </Button>
              <span className="px-2 text-sm text-gray-100">
                Page <span className="font-semibold">{usersTablePage}</span> of{' '}
                <span className="font-semibold">{totalUserPages}</span>
              </span>
              <Button
                type="button"
                disabled={usersTablePage >= totalUserPages}
                onClick={() => setUsersTablePage((prev) => Math.min(totalUserPages, prev + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
        {users.length === 0 && <p className="text-center text-gray-500 py-8">No users found</p>}
        {users.length > 0 && filteredUsers.length === 0 && (
          <p className="text-center text-gray-500 py-8">No users match your filters. Try adjusting or clear filters.</p>
        )}
      </GlassCard>

      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        type={createType}
        courses={courses}
        onSuccess={loadData}
        onFeedback={showMessage}
      />
      <BulkCreateStudentsModal
        isOpen={showBulkCreateModal}
        onClose={() => setShowBulkCreateModal(false)}
        courses={sortedCourses}
        onSuccess={loadData}
        onFeedback={showMessage}
      />
      <BulkCreateTeachersModal
        isOpen={showBulkTeachersModal}
        onClose={() => setShowBulkTeachersModal(false)}
        courses={sortedCourses}
        onSuccess={loadData}
        onFeedback={showMessage}
      />

      {appMessage && (
        <MessageModal
          isOpen
          onClose={() => setAppMessage(null)}
          title={appMessage.title}
          message={appMessage.message}
          variant={appMessage.variant}
        />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, type: null, userId: null, userName: null })}
        onConfirm={() => {
          if (confirmModal.type === 'reset') handleResetPassword();
          else if (confirmModal.type === 'delete') handleDeleteUser();
        }}
        title={confirmModal.type === 'reset' ? 'Reset Password' : 'Delete User'}
        message={confirmModal.type === 'reset' 
          ? `Are you sure you want to reset the password for ${confirmModal.userName}?`
          : `Are you sure you want to delete ${confirmModal.userName}? This action cannot be undone.`
        }
        confirmText={confirmModal.type === 'reset' ? 'Reset' : 'Delete'}
        variant={confirmModal.type === 'reset' ? 'warning' : 'danger'}
      />
    </DashboardLayout>
  );
}

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'student' | 'teacher' | 'admin';
  courses: any[];
  onSuccess: () => void;
  onFeedback: (payload: AppMessagePayload) => void;
}

function CreateUserModal({ isOpen, onClose, type, courses, onSuccess, onFeedback }: CreateUserModalProps) {
  const [loading, setLoading] = useState(false);
  const [officialSections, setOfficialSections] = useState<OfficialSectionRow[]>([]);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    name_title: '',
    course_id: '',
    grade_level: '1st',
    section_id: '',
    semester: '1st Sem',
  });

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const res = await supabase.from('sections').select('*').eq('is_active', true).order('name', { ascending: true });
        if (res.error) throw res.error;
        setOfficialSections((res.data || []) as OfficialSectionRow[]);
      } catch {
        setOfficialSections([]);
      }
    })();
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      name_title: '',
      course_id: '',
      grade_level: '1st',
      section_id: '',
      semester: '1st Sem',
    });
  }, [isOpen, type]);

  const availableOfficialSections = useMemo(() => {
    if (type !== 'student') return [];
    const courseId = (formData.course_id || '').trim();
    const year = (formData.grade_level || '').trim();
    return officialSections.filter((s) => {
      if (courseId && (s.course_id || '') !== courseId) return false;
      if (year && (s.year_level || '') !== year) return false;
      return true;
    });
  }, [officialSections, formData.course_id, formData.grade_level, type]);

  const officialSectionOptions = useMemo(
    () =>
      sectionSelectOptions(
        availableOfficialSections,
        availableOfficialSections.length ? 'Select official section' : 'No official sections found (use legacy)'
      ),
    [availableOfficialSections]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { first_name: normalizedFirstName, last_name: normalizedLastName } = normalizePersonNames({
        first_name: formData.first_name,
        last_name: formData.last_name,
      });
      const normalizedTeacherTitle = type === 'teacher' ? normalizeTeacherTitle(formData.name_title) : '';

      if (type === 'teacher' && !normalizedTeacherTitle) {
        onFeedback({
          title: 'Title required',
          message: 'Select Mr., Mrs., or Ms. for the teacher.',
          variant: 'warning',
        });
        setLoading(false);
        return;
      }

      const selectedOfficial = formData.section_id
        ? availableOfficialSections.find((s) => s.id === formData.section_id) ||
          officialSections.find((s) => s.id === formData.section_id) ||
          null
        : null;

      if (type === 'student' && !selectedOfficial?.id) {
        onFeedback({
          title: 'Section required',
          message: 'Select an official section first (create it in Admin → Sections).',
          variant: 'warning',
        });
        setLoading(false);
        return;
      }

      const effectiveCourseId = selectedOfficial?.course_id || formData.course_id;
      const effectiveYearLevel = selectedOfficial?.year_level || formData.grade_level;
      const legacySectionValue = (selectedOfficial?.section_code || selectedOfficial?.name || '').trim();

      const course = courses.find(c => c.id === effectiveCourseId);
      const tempPassword = generateTempPassword();
      const passwordHash = await hashPassword(tempPassword);

      let username: string | null = null;

      if (type === 'student') {
        if (!effectiveCourseId?.trim()) {
          onFeedback({
            title: 'Course required',
            message:
              'Select a course so the correct student ID prefix can be assigned (e.g. STUD-OA-, STUD-VTED-, STUD-CS-).',
            variant: 'warning',
          });
          setLoading(false);
          return;
        }

        let courseName = course?.name?.trim();
        if (!courseName) {
          const { data: courseRow } = await supabase
            .from('courses')
            .select('name')
            .eq('id', effectiveCourseId)
            .maybeSingle();
          courseName = courseRow?.name?.trim();
        }
        if (!courseName) {
          onFeedback({
            title: 'Course not found',
            message: 'Could not load the selected course. Choose a course again, then create the student.',
            variant: 'error',
          });
          setLoading(false);
          return;
        }

        const { data: existingUsers } = await supabase
          .from('users')
          .select('username')
          .like('username', studentUsernameLikePattern(courseName, effectiveYearLevel));

        const nextSequence = getNextStudentUsernameSequence(
          (existingUsers || []).map((u) => u.username),
          courseName,
          effectiveYearLevel
        );

        username = generateStudentUsername(courseName, effectiveYearLevel, nextSequence);
      }

      if (formData.email?.trim()) {
        const { data: existingEmail } = await supabase
          .from('users')
          .select('id')
          .eq('email', formData.email.trim())
          .maybeSingle();

        if (existingEmail?.id) {
          onFeedback({
            title: 'Email already in use',
            message: 'A user with this email already exists. Use a different email or edit the existing user.',
            variant: 'warning',
          });
          setLoading(false);
          return;
        }
      }

      if (username) {
        const { data: existingUsername } = await supabase
          .from('users')
          .select('id')
          .eq('username', username)
          .maybeSingle();

        if (existingUsername?.id) {
          onFeedback({
            title: 'Student ID in use',
            message: 'This student ID is already in use. Try again or contact support.',
            variant: 'error',
          });
          setLoading(false);
          return;
        }
      }

      // Create the user
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          email: formData.email,
          password_hash: passwordHash,
          role: type,
          username,
          is_temp_password: true,
          temp_password_visible: tempPassword,
          is_dropout: false,
          first_name: normalizedFirstName,
          last_name: normalizedLastName,
          name_title: type === 'teacher' ? normalizedTeacherTitle : null,
          course_id: type === 'admin' ? null : effectiveCourseId || null,
          year_level: type === 'student' ? effectiveYearLevel : null,
          section: type === 'student' ? legacySectionValue : null,
        })
        .select()
        .single();

      if (userError) {
        // If error is about duplicate, try to handle it
        if (userError.message?.includes('duplicate') || userError.code === '23505') {
          onFeedback({
            title: 'Duplicate email',
            message: 'A user with this email already exists. Please use a different email.',
            variant: 'error',
          });
          setLoading(false);
          return;
        }
        throw userError;
      }

      // If creating a student, also create student record
      if (type === 'student' && userData?.id) {
        // Check if student record already exists
        const { data: existingStudent } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', userData.id)
          .limit(1);

        if (!existingStudent || existingStudent.length === 0) {
          const { data: studentData, error: studentError } = await supabase
            .from('students')
            .insert({
              first_name: normalizedFirstName,
              last_name: normalizedLastName,
              grade_level: effectiveYearLevel,
              section_id: selectedOfficial?.id || null,
              section: legacySectionValue,
              course_id: effectiveCourseId,
              user_id: userData.id,
            })
            .select()
            .single();

          if (studentError && !studentError.message?.includes('duplicate')) {
            console.error('Student creation error:', studentError);
          }

          // Auto-enroll student in subjects for their year level and course
          if (studentData?.id) {
            const { data: matchingSubjects } = await supabase
              .from('subjects')
              .select('*')
              .eq('course_id', effectiveCourseId)
              .eq('year_level', effectiveYearLevel)
              .eq('semester', formData.semester);

            if (matchingSubjects && matchingSubjects.length > 0) {
              const enrollments = matchingSubjects.map(sub => ({
                student_id: studentData.id,
                subject_id: sub.id,
              }));
              await supabase.from('student_subjects').insert(enrollments);
            }
          }
        }
      }

      let emailNote = formData.email
        ? ''
        : 'No email on file; share credentials manually.';
      if (formData.email) {
        const credentialRole =
          type === 'admin' ? 'admin' : type === 'teacher' ? 'teacher' : 'student';
        const emailData = generateStudentCredentialEmail(
          normalizedFirstName,
          username || formData.email,
          tempPassword,
          credentialRole
        );
        const sent = await sendEmail(formData.email, emailData.subject, emailData.html);
        emailNote = sent.success
          ? `Credentials sent to ${formData.email}.`
          : `Email could not be sent (${sent.error ?? 'unknown error'}). Share credentials manually.`;
      }

      const loginLine =
        type === 'student'
          ? `Student ID: ${username}`
          : `Login email: ${formData.email}`;

      onFeedback({
        title: 'User created',
        message: `${loginLine}\nTemporary password: ${tempPassword}\n\n${emailNote}`,
        variant: 'success',
      });
      onSuccess();
      onClose();
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        name_title: '',
        course_id: '',
        grade_level: '1st',
        section_id: '',
        semester: '1st Sem',
      });
    } catch (err: any) {
      console.error('Create user error:', err);
      onFeedback({
        title: 'Could not create user',
        message: err.message || 'Something went wrong. Try again.',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Create ${type === 'student' ? 'Student' : type === 'teacher' ? 'Teacher' : 'Admin'}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
        <Input label="First Name" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} required autoComplete="off" />
        <Input label="Last Name" value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} required autoComplete="off" />
        <Input label="Email" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required autoComplete="off" />
        
        {type === 'student' && (
          <>
            <Select
              label="Course"
              name="student-course"
              autoComplete="off"
              value={formData.course_id}
              onChange={e => setFormData({ ...formData, course_id: e.target.value, section_id: '' })}
              options={courseSelectOptions(courses, 'Select a course')}
              required
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Select
                label="Year Level"
                value={formData.grade_level}
                onChange={e => setFormData({ ...formData, grade_level: e.target.value, section_id: '' })}
                options={[{ value: '1st', label: '1st Year' }, { value: '2nd', label: '2nd Year' }, { value: '3rd', label: '3rd Year' }, { value: '4th', label: '4th Year' }]}
              />
              <Select
                label="Official Section"
                value={formData.section_id}
                onChange={(e) => {
                  const nextId = e.target.value;
                  const sec =
                    availableOfficialSections.find((s) => s.id === nextId) ||
                    officialSections.find((s) => s.id === nextId) ||
                    null;
                  setFormData({
                    ...formData,
                    section_id: nextId,
                    grade_level: sec?.year_level || formData.grade_level,
                    course_id: sec?.course_id || formData.course_id,
                  });
                }}
                options={officialSectionOptions}
                required
              />
              <Select label="Semester" value={formData.semester} onChange={e => setFormData({ ...formData, semester: e.target.value })} options={[{ value: '1st Sem', label: '1st Sem' }, { value: '2nd Sem', label: '2nd Sem' }]} />
            </div>
          </>
        )}
        
        {type === 'teacher' && (
          <>
            <Select
              label="Title"
              value={formData.name_title}
              onChange={(e) => setFormData({ ...formData, name_title: e.target.value })}
              options={TEACHER_TITLE_SELECT_OPTIONS}
              required
            />
            <Select
              label="Course (optional)"
              value={formData.course_id}
              onChange={e => setFormData({ ...formData, course_id: e.target.value })}
              options={sortSelectOptions(
                [{ value: '', label: 'None — not linked to a program' }, ...sortByName(courses).map((c) => ({ value: c.id, label: c.name || '' }))],
                ['']
              )}
            />
          </>
        )}

        <div className="flex gap-4 pt-4">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            <XCircle className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? (
              <Spinner size="sm" />
            ) : (
              <>
                <Plus className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                Create
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

interface EditUserModalProps {
  user: any;
  courses: any[];
  onSave: (userId: string, data: any, role?: string) => void;
}

interface BulkCreateStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: any[];
  onSuccess: () => void;
  onFeedback: (payload: AppMessagePayload) => void;
}

interface BulkStudentRow {
  first_name?: string;
  last_name?: string;
  email?: string;
  course_name?: string;
  year_level?: string;
  section?: string;
  semester?: string;
}

interface BulkCreateTeachersModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: any[];
  onSuccess: () => void;
  onFeedback: (payload: AppMessagePayload) => void;
}

interface BulkTeacherRow {
  first_name?: string;
  last_name?: string;
  email?: string;
  name_title?: string;
  course_name?: string;
}

function BulkCreateTeachersModal({
  isOpen,
  onClose,
  courses,
  onSuccess,
  onFeedback,
}: BulkCreateTeachersModalProps) {
  const [loading, setLoading] = useState(false);
  const [uploadResults, setUploadResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  useEffect(() => {
    if (!isOpen) setUploadResults(null);
  }, [isOpen]);

  const downloadTemplate = () => {
    const template = [
      {
        first_name: 'Ana',
        last_name: 'Reyes',
        name_title: 'Mrs.',
        email: 'ana.reyes@example.com',
        course_name: courses[0]?.name || 'BSCS',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Teachers');
    XLSX.writeFile(wb, 'bulk_teachers_template.xlsx');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setUploadResults(null);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<BulkTeacherRow>(sheet);
      if (!rows.length) {
        onFeedback({ title: 'No data found', message: 'The uploaded file is empty.', variant: 'warning' });
        return;
      }
      const emailSet = new Set<string>();
      let success = 0;
      let failed = 0;
      const errors: string[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNo = i + 2;
        try {
          const { first_name: firstName, last_name: lastName } = normalizePersonNames({
            first_name: String(row.first_name || '').trim(),
            last_name: String(row.last_name || '').trim(),
          });
          const email = String(row.email || '').trim().toLowerCase();
          const courseName = String(row.course_name || '').trim().toLowerCase();
          const nameTitle = normalizeTeacherTitle(row.name_title);
          if (!firstName || !lastName || !email) {
            failed += 1;
            errors.push(`Row ${rowNo}: first_name, last_name, and email are required.`);
            continue;
          }
          if (!nameTitle) {
            failed += 1;
            errors.push(`Row ${rowNo}: name_title is required (Mr., Mrs., or Ms.).`);
            continue;
          }
          if (emailSet.has(email)) {
            failed += 1;
            errors.push(`Row ${rowNo}: duplicate email in file.`);
            continue;
          }
          const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
          if (existing?.id) {
            failed += 1;
            errors.push(`Row ${rowNo}: email already registered.`);
            continue;
          }
          let courseId: string | null = null;
          if (courseName) {
            const matched = courses.find((c) => String(c.name || '').trim().toLowerCase() === courseName);
            if (!matched?.id) {
              failed += 1;
              errors.push(`Row ${rowNo}: course "${row.course_name}" not found.`);
              continue;
            }
            courseId = matched.id;
          }
          const tempPassword = generateTempPassword();
          const passwordHash = await hashPassword(tempPassword);
          const { error: userError } = await supabase.from('users').insert({
            email,
            password_hash: passwordHash,
            role: 'teacher',
            is_temp_password: true,
            temp_password_visible: tempPassword,
            first_name: firstName,
            last_name: lastName,
            name_title: nameTitle,
            course_id: courseId,
          });
          if (userError) {
            failed += 1;
            errors.push(`Row ${rowNo}: ${userError.message}`);
            continue;
          }
          const emailData = generateStudentCredentialEmail(firstName, email, tempPassword, 'teacher');
          const sent = await sendEmail(email, emailData.subject, emailData.html);
          if (!sent.success) {
            errors.push(`Row ${rowNo}: created, but email failed (${sent.error || 'unknown'}).`);
          }
          emailSet.add(email);
          success += 1;
        } catch (err: any) {
          failed += 1;
          errors.push(`Row ${rowNo}: ${err?.message || 'failed'}`);
        }
      }
      setUploadResults({ success, failed, errors: errors.slice(0, 12) });
      onFeedback({
        title: 'Bulk import finished',
        message: `Created ${success} teacher account(s). Failed: ${failed}.`,
        variant: failed > 0 ? 'warning' : 'success',
      });
      onSuccess();
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bulk Add Teachers" size="md">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Required: <code>first_name</code>, <code>last_name</code>, <code>name_title</code> (Mr., Mrs., or Ms.),{' '}
          <code>email</code>. Optional: <code>course_name</code>.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="button" variant="secondary" onClick={downloadTemplate}>
            <Download className="h-5 w-5 shrink-0" />
            Download template
          </Button>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="w-full min-w-0 text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-[#800000] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
          />
        </div>
        {loading && <Spinner size="sm" />}
        {uploadResults && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-center">
              <p className="text-xl font-bold text-green-700">{uploadResults.success}</p>
              <p className="text-sm text-green-800">Created</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center">
              <p className="text-xl font-bold text-red-700">{uploadResults.failed}</p>
              <p className="text-sm text-red-800">Failed</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function BulkCreateStudentsModal({
  isOpen,
  onClose,
  courses,
  onSuccess,
  onFeedback,
}: BulkCreateStudentsModalProps) {
  const [loading, setLoading] = useState(false);
  const [uploadResults, setUploadResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [officialSections, setOfficialSections] = useState<OfficialSectionRow[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setUploadResults(null);
      return;
    }
    (async () => {
      try {
        const res = await supabase.from('sections').select('*').eq('is_active', true).order('name', { ascending: true });
        if (res.error) throw res.error;
        setOfficialSections((res.data || []) as OfficialSectionRow[]);
      } catch {
        setOfficialSections([]);
      }
    })();
  }, [isOpen]);

  const downloadTemplate = () => {
    const template = [
      {
        first_name: 'Juan',
        last_name: 'Dela Cruz',
        email: 'juan.delacruz@example.com',
        course_name: courses[0]?.name || 'BSCS',
        year_level: '1st',
        section: 'A',
        semester: '1st Sem',
      },
      {
        first_name: 'Maria',
        last_name: 'Santos',
        email: 'maria.santos@example.com',
        course_name: courses[0]?.name || 'BSCS',
        year_level: '1st',
        section: 'A',
        semester: '1st Sem',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'bulk_students_template.xlsx');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setUploadResults(null);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<BulkStudentRow>(sheet);

      if (!rows.length) {
        onFeedback({
          title: 'No data found',
          message: 'The uploaded file is empty. Add rows and try again.',
          variant: 'warning',
        });
        return;
      }

      const { data: existingUsers } = await supabase.from('users').select('username,email').like('username', 'STUD-%');
      const existingUsernameSet = new Set((existingUsers || []).map((u: any) => String(u.username || '').toUpperCase()));
      const existingEmailSet = new Set(
        (existingUsers || []).map((u: any) => String(u.email || '').trim().toLowerCase()).filter(Boolean)
      );
      const generatedEmailSet = new Set<string>();

      const allocateStudentUsername = createStudentUsernameAllocator(
        (existingUsers || []).map((u: { username?: string | null }) => u.username)
      );

      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const rowNo = i + 2;
        try {
          const { first_name: firstName, last_name: lastName } = normalizePersonNames({
            first_name: String(row.first_name || '').trim(),
            last_name: String(row.last_name || '').trim(),
          });
          const email = String(row.email || '').trim().toLowerCase();
          const courseName = String(row.course_name || '').trim().toLowerCase();
          const yearLevel = String(row.year_level || '').trim() || '1st';
          const rawSection = String(row.section || '').trim();
          const normalizedLegacy = normalizeSchoolSection(rawSection) || DEFAULT_SCHOOL_SECTION;
          const semester = String(row.semester || '').trim() || '1st Sem';

          if (!firstName || !lastName || !email || !courseName) {
            failed += 1;
            errors.push(`Row ${rowNo}: first_name, last_name, email, and course_name are required.`);
            continue;
          }

          const matchedCourse = courses.find((c) => String(c.name || '').trim().toLowerCase() === courseName);
          if (!matchedCourse?.id) {
            failed += 1;
            errors.push(`Row ${rowNo}: course "${row.course_name}" not found.`);
            continue;
          }

          const matchedOfficial =
            officialSections.find(
              (s) =>
                (s.course_id || '') === matchedCourse.id &&
                (s.year_level || '') === yearLevel &&
                (normalizeSchoolSection(s.section_code || '') && normalizeSchoolSection(s.section_code || '') === normalizedLegacy)
            ) ||
            officialSections.find(
              (s) =>
                (s.course_id || '') === matchedCourse.id &&
                (s.year_level || '') === yearLevel &&
                String(s.name || '').trim().toLowerCase() === rawSection.toLowerCase()
            ) ||
            null;

          const sectionId = matchedOfficial?.id || null;
          const sectionLegacyValue =
            (matchedOfficial?.section_code || matchedOfficial?.name || '').trim() || normalizedLegacy;

          if (existingEmailSet.has(email) || generatedEmailSet.has(email)) {
            failed += 1;
            errors.push(`Row ${rowNo}: email "${email}" already exists in this import or database.`);
            continue;
          }

          let username = '';
          let allocateAttempts = 0;
          while (!username && allocateAttempts < 1000) {
            allocateAttempts += 1;
            const candidate = allocateStudentUsername(matchedCourse.name, yearLevel);
            if (!existingUsernameSet.has(candidate.toUpperCase())) {
              username = candidate;
              existingUsernameSet.add(candidate.toUpperCase());
            }
          }
          if (!username) {
            failed += 1;
            errors.push(`Row ${rowNo}: could not assign a unique student ID.`);
            continue;
          }

          const tempPassword = generateTempPassword();
          const passwordHash = await hashPassword(tempPassword);

          const { data: userData, error: userError } = await supabase
            .from('users')
            .insert({
              email,
              password_hash: passwordHash,
              role: 'student',
              username,
              is_temp_password: true,
              temp_password_visible: tempPassword,
              is_dropout: false,
              first_name: firstName,
              last_name: lastName,
              course_id: matchedCourse.id,
              year_level: yearLevel,
              section: sectionLegacyValue,
            })
            .select()
            .single();

          if (userError || !userData?.id) {
            failed += 1;
            errors.push(`Row ${rowNo}: could not create user (${userError?.message || 'unknown error'}).`);
            continue;
          }

          const { data: studentData, error: studentError } = await supabase
            .from('students')
            .insert({
              first_name: firstName,
              last_name: lastName,
              grade_level: yearLevel,
              section_id: sectionId,
              section: sectionLegacyValue,
              course_id: matchedCourse.id,
              user_id: userData.id,
            })
            .select()
            .single();

          if (studentError || !studentData?.id) {
            failed += 1;
            errors.push(`Row ${rowNo}: student profile not created (${studentError?.message || 'unknown error'}).`);
            continue;
          }

          const { data: matchingSubjects } = await supabase
            .from('subjects')
            .select('id')
            .eq('course_id', matchedCourse.id)
            .eq('year_level', yearLevel)
            .eq('semester', semester);

          if (matchingSubjects && matchingSubjects.length > 0) {
            const enrollments = matchingSubjects.map((s: any) => ({
              student_id: studentData.id,
              subject_id: s.id,
            }));
            await supabase.from('student_subjects').upsert(enrollments, {
              onConflict: 'student_id,subject_id',
              ignoreDuplicates: true,
            });
          }

          const emailData = generateStudentCredentialEmail(firstName, username, tempPassword, 'student');
          const sent = await sendEmail(email, emailData.subject, emailData.html);
          if (!sent.success) {
            errors.push(`Row ${rowNo}: created, but credential email failed (${sent.error || 'unknown error'}).`);
          }

          existingEmailSet.add(email);
          generatedEmailSet.add(email);
          success += 1;
        } catch (err: any) {
          failed += 1;
          errors.push(`Row ${rowNo}: ${err?.message || 'processing failed'}`);
        }
      }

      setUploadResults({ success, failed, errors: errors.slice(0, 12) });
      onFeedback({
        title: 'Bulk import finished',
        message: `Created ${success} student account(s). Failed: ${failed}.`,
        variant: failed > 0 ? 'warning' : 'success',
      });
      onSuccess();
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bulk Add Students" size="md">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Upload a CSV/XLSX file to add many students at once (e.g., an entire section).
          Required columns: <code>first_name</code>, <code>last_name</code>, <code>email</code>, <code>course_name</code>.
        </p>
        <p className="text-sm text-gray-600">
          Optional columns: <code>year_level</code> (default: 1st), <code>section</code> (default: A),
          <code>semester</code> (default: 1st Sem).
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="button" variant="secondary" onClick={downloadTemplate}>
            <Download className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            Download template
          </Button>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="w-full min-w-0 text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-[#800000] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#600000]"
          />
        </div>

        {loading && (
          <div className="pt-2">
            <Spinner size="sm" />
          </div>
        )}

        {uploadResults && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-center">
                <p className="text-xl font-bold text-green-700">{uploadResults.success}</p>
                <p className="text-sm text-green-800">Created</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center">
                <p className="text-xl font-bold text-red-700">{uploadResults.failed}</p>
                <p className="text-sm text-red-800">Failed</p>
              </div>
            </div>
            {uploadResults.errors.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="mb-2 text-sm font-semibold text-amber-900">Import notes</p>
                <ul className="space-y-1 text-xs text-amber-900">
                  {uploadResults.errors.map((err, idx) => (
                    <li key={`${idx}-${err}`}>- {err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function EditUserModal({ user, courses, onSave }: EditUserModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [officialSections, setOfficialSections] = useState<OfficialSectionRow[]>([]);
  const [formData, setFormData] = useState({
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    email: user.email || '',
    name_title: user.name_title || '',
    year_level: user.year_level || '',
    section_id: '',
    course_id: user.course_id || '',
    is_dropout: Boolean(user.is_dropout),
  });

  useEffect(() => {
    setFormData({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      name_title: user.name_title || '',
      year_level: user.year_level || '',
      section_id: '',
      course_id: user.course_id || '',
      is_dropout: Boolean(user.is_dropout),
    });
  }, [user]);

  useEffect(() => {
    if (!isOpen || user.role !== 'student') return;
    (async () => {
      try {
        const [secRes, studentRes] = await Promise.all([
          supabase.from('sections').select('*').eq('is_active', true).order('name', { ascending: true }),
          supabase.from('students').select('section_id,course_id,grade_level,section').eq('user_id', user.id).maybeSingle(),
        ]);
        if (secRes.error) throw secRes.error;
        if (studentRes.error) throw studentRes.error;
        setOfficialSections((secRes.data || []) as OfficialSectionRow[]);
        const st = studentRes.data as any;
        if (st) {
          setFormData((prev) => ({
            ...prev,
            section_id: st.section_id || '',
            course_id: st.course_id || prev.course_id,
            year_level: st.grade_level || prev.year_level,
          }));
        }
      } catch {
        setOfficialSections([]);
      }
    })();
  }, [isOpen, user.id, user.role]);

  const availableOfficialSections = useMemo(() => {
    if (user.role !== 'student') return [];
    const courseId = (formData.course_id || '').trim();
    const year = (formData.year_level || '').trim();
    return officialSections.filter((s) => {
      if (courseId && (s.course_id || '') !== courseId) return false;
      if (year && (s.year_level || '') !== year) return false;
      return true;
    });
  }, [officialSections, formData.course_id, formData.year_level, user.role]);

  const officialSectionOptions = useMemo(
    () =>
      sectionSelectOptions(
        availableOfficialSections,
        availableOfficialSections.length ? 'Select official section' : 'No official sections found (use legacy)'
      ),
    [availableOfficialSections]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSave(user.id, formData, user.role);
    setLoading(false);
    setIsOpen(false);
  };

  return (
    <>
      <button 
        type="button"
        className="p-2 rounded-lg glass-hover text-[#800000]" 
        onClick={() => setIsOpen(true)}
        title="Edit User"
      >
        <Pencil className="h-[1.15rem] w-[1.15rem] shrink-0" strokeWidth={2} aria-hidden />
      </button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Edit User" size="md">
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <Input
            label="First Name"
            value={formData.first_name}
            onChange={e => setFormData({ ...formData, first_name: e.target.value })}
            required
            autoComplete="off"
          />
          <Input
            label="Last Name"
            value={formData.last_name}
            onChange={e => setFormData({ ...formData, last_name: e.target.value })}
            required
            autoComplete="off"
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            required
            autoComplete="off"
          />
          {user.role === 'teacher' && (
            <Select
              label="Title"
              value={formData.name_title}
              onChange={(e) => setFormData({ ...formData, name_title: e.target.value })}
              options={TEACHER_TITLE_SELECT_OPTIONS}
              required
            />
          )}
          {(user.role === 'student' || user.role === 'teacher') && (
            <>
              <Select
                label={user.role === 'teacher' ? 'Course (optional)' : 'Course'}
                value={formData.course_id}
                onChange={e => setFormData({ ...formData, course_id: e.target.value, section_id: '' })}
                options={
                  user.role === 'teacher'
                    ? sortSelectOptions(
                        [{ value: '', label: 'None — not linked to a program' }, ...sortByName(courses).map((c) => ({ value: c.id, label: c.name || '' }))],
                        ['']
                      )
                    : sortByName(courses).map((c) => ({ value: c.id, label: c.name || '' }))
                }
                required={user.role === 'student'}
              />
              <Select
                label="Year Level"
                value={formData.year_level}
                onChange={e => setFormData({ ...formData, year_level: e.target.value, section_id: '' })}
                options={[{ value: '1st', label: '1st Year' }, { value: '2nd', label: '2nd Year' }, { value: '3rd', label: '3rd Year' }, { value: '4th', label: '4th Year' }]}
              />
              {user.role === 'student' ? (
                <>
                  <Select
                    label="Official Section"
                    value={formData.section_id}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      const sec =
                        availableOfficialSections.find((s) => s.id === nextId) ||
                        officialSections.find((s) => s.id === nextId) ||
                        null;
                      setFormData({
                        ...formData,
                        section_id: nextId,
                        year_level: sec?.year_level || formData.year_level,
                        course_id: sec?.course_id || formData.course_id,
                      });
                    }}
                    options={officialSectionOptions}
                  />
                  <Select
                    label="Student status"
                    value={formData.is_dropout ? 'dropout' : 'active'}
                    onChange={e => setFormData({ ...formData, is_dropout: e.target.value === 'dropout' })}
                    options={[
                      { value: 'active', label: 'Active' },
                      { value: 'dropout', label: 'Dropout (locked)' },
                    ]}
                  />
                </>
              ) : null}
            </>
          )}
          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="secondary"
              className="flex-1 border-maroon-300 text-[#800000] hover:bg-maroon-50"
              onClick={() => setIsOpen(false)}
            >
              <XCircle className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                  Save
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}