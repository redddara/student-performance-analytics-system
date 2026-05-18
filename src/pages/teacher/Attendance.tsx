import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Download, Lock, Save, Search, SendHorizonal, Users } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import {
  GlassCard,
  Select,
  Button,
  Modal,
  MessageModal,
  PageSkeletonLoader,
  type AppMessagePayload,
} from '../../components/ui';
import { formatPersonDisplayName } from '../../lib/personName';
import {
  compareAlphabetical,
  compareNumeric,
  sortByLabel,
  sortByName,
  sortByStudentName,
  sortSelectOptions,
} from '../../lib/sortUtils';
import { useAuthStore } from '../../store';
import { supabase } from '../../lib/supabase';
import { useSupabaseLiveReload } from '../../lib/useSupabaseLiveReload';
import { useInitialPageLoading } from '../../lib/useInitialPageLoading';
import { formatClassDaysLabel, isScheduledClassDay } from '../../lib/classSchedule';
import {
  attendanceEditBlockMessage,
  resolveAttendanceEditAccess,
  type AttendanceAccessRequest,
} from '../../lib/attendanceAccess';
import {
  ATTENDANCE_QUARTERS,
  enrichAttendanceRecords,
  normalizeAttendanceScore,
  scoreToStatus,
  statusToScore,
  summarizeByStudent,
  type AttendanceStatus,
} from '../../lib/attendance';
import { exportAttendanceWorkbook } from '../../lib/attendanceExport';

type AttendanceSessionType = 'class' | 'no_class';
import {
  fetchActiveOfficialSections,
  matchesOfficialSectionFilter,
  officialSectionDisplayName,
  officialSectionFilterOptions,
  sectionsForStudentFilter,
  type OfficialSection,
} from '../../lib/officialSections';
import { BarChart, Bar, CartesianGrid, LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function TeacherAttendancePage() {
  const { user } = useAuthStore();
  const { loading, beginLoad, endLoad } = useInitialPageLoading();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [studentEnrollments, setStudentEnrollments] = useState<any[]>([]);

  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [filterCourseId, setFilterCourseId] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [officialSections, setOfficialSections] = useState<OfficialSection[]>([]);

  useEffect(() => {
    void fetchActiveOfficialSections().then(setOfficialSections);
  }, []);

  const sectionsById = useMemo(
    () => new Map(officialSections.map((s) => [s.id, s])),
    [officialSections]
  );
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedQuarter, setSelectedQuarter] = useState(1);
  const [statusByStudent, setStatusByStudent] = useState<Record<string, AttendanceStatus>>({});
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<
    {
      attendance_date: string;
      session_type: AttendanceSessionType;
      quarter?: number | null;
      is_locked?: boolean;
    }[]
  >([]);
  const [dateSessionType, setDateSessionType] = useState<AttendanceSessionType>('class');
  const [sessionLocked, setSessionLocked] = useState(false);
  const [accessRequest, setAccessRequest] = useState<AttendanceAccessRequest | null>(null);
  const [showAccessRequestModal, setShowAccessRequestModal] = useState(false);
  const [accessRequestReason, setAccessRequestReason] = useState('');
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const analyticsSubjectRef = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [appMessage, setAppMessage] = useState<AppMessagePayload | null>(null);

  const selectedSubjectIdRef = useRef(selectedSubjectId);
  const selectedDateRef = useRef(selectedDate);
  const studentEnrollmentsRef = useRef(studentEnrollments);
  /** Blocks background reload from resetting in-progress marks. */
  const attendanceDraftDirtyRef = useRef(false);
  const [hasUnsavedAttendance, setHasUnsavedAttendance] = useState(false);
  const markAttendanceDraftDirty = () => {
    attendanceDraftDirtyRef.current = true;
    setHasUnsavedAttendance(true);
  };
  const clearAttendanceDraftDirty = () => {
    attendanceDraftDirtyRef.current = false;
    setHasUnsavedAttendance(false);
  };
  selectedSubjectIdRef.current = selectedSubjectId;
  selectedDateRef.current = selectedDate;
  studentEnrollmentsRef.current = studentEnrollments;

  const rosterStudentIdsForSubject = (subjectId: string, enrollments: any[]) => {
    const byId = new Map<string, string>();
    enrollments
      .filter((record: any) => record.subject_id === subjectId)
      .forEach((record: any) => {
        const student = record.student;
        if (student?.id) byId.set(student.id, student.id);
      });
    return Array.from(byId.values());
  };

  const loadAttendanceForDate = useCallback(async (options?: { force?: boolean }) => {
    if (attendanceDraftDirtyRef.current && !options?.force) return;

    const sid = selectedSubjectIdRef.current;
    const d = selectedDateRef.current;
    const enrollments = studentEnrollmentsRef.current;
    if (!sid) {
      setStatusByStudent({});
      setDateSessionType('class');
      return;
    }

    const studentIds = rosterStudentIdsForSubject(sid, enrollments);
    if (!studentIds.length) {
      setStatusByStudent({});
      setDateSessionType('class');
      return;
    }

    const [{ data: sessionRow }, { data: accessRow }] = await Promise.all([
      supabase
        .from('attendance_sessions')
        .select('session_type, quarter, is_locked')
        .eq('subject_id', sid)
        .eq('attendance_date', d)
        .maybeSingle(),
      supabase
        .from('attendance_access_requests')
        .select('*')
        .eq('subject_id', sid)
        .eq('attendance_date', d)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const sessionType: AttendanceSessionType =
      sessionRow?.session_type === 'no_class' ? 'no_class' : 'class';
    setDateSessionType(sessionType);
    setSessionLocked(Boolean(sessionRow?.is_locked));
    setAccessRequest((accessRow as AttendanceAccessRequest) || null);
    if (sessionRow?.quarter && sessionRow.quarter >= 1 && sessionRow.quarter <= 4) {
      setSelectedQuarter(sessionRow.quarter);
    }

    if (sessionType === 'no_class') {
      setStatusByStudent({});
      return;
    }

    const { data, error } = await supabase
      .from('attendance_records')
      .select('student_id, is_present, score')
      .eq('subject_id', sid)
      .eq('attendance_date', d)
      .in('student_id', studentIds);

    if (error) {
      setAppMessage({
        title: 'Attendance table missing',
        message: 'Please run the latest Supabase migration (attendance scores), then reload.',
        variant: 'warning',
      });
      setStatusByStudent({});
      return;
    }

    const nextMap: Record<string, AttendanceStatus> = {};
    studentIds.forEach((studentId: string) => {
      nextMap[studentId] = 'absent';
    });
    (data || []).forEach((record: any) => {
      nextMap[record.student_id] = scoreToStatus(normalizeAttendanceScore(record));
    });
    setStatusByStudent(nextMap);
    clearAttendanceDraftDirty();
  }, []);

  const loadAttendanceAnalytics = useCallback(async () => {
    const sid = selectedSubjectIdRef.current;
    const enrollments = studentEnrollmentsRef.current;
    if (!sid) {
      setAttendanceHistory([]);
      return;
    }

    const studentIds = rosterStudentIdsForSubject(sid, enrollments);
    if (!studentIds.length) {
      setAttendanceHistory([]);
      return;
    }

    const showAnalyticsSpinner = analyticsSubjectRef.current !== sid;
    if (showAnalyticsSpinner) setAnalyticsLoading(true);
    const [recordsRes, sessionsRes] = await Promise.all([
      supabase
        .from('attendance_records')
        .select('student_id, is_present, score, attendance_date')
        .eq('subject_id', sid)
        .in('student_id', studentIds)
        .order('attendance_date', { ascending: true }),
      supabase
        .from('attendance_sessions')
        .select('attendance_date, session_type, quarter')
        .eq('subject_id', sid),
    ]);

    if (recordsRes.error || sessionsRes.error) {
      setAttendanceHistory([]);
      setAttendanceSessions([]);
      setAnalyticsLoading(false);
      return;
    }

    setAttendanceSessions(
      (sessionsRes.data || []) as {
        attendance_date: string;
        session_type: AttendanceSessionType;
        quarter?: number | null;
      }[]
    );
    setAttendanceHistory(recordsRes.data || []);
    analyticsSubjectRef.current = sid;
    setAnalyticsLoading(false);
  }, []);

  const loadData = useCallback(async () => {
    beginLoad();
    try {
      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('*, course:courses(*)')
        .eq('teacher_id', user?.id)
        .order('name');

      const subjects = subjectsData || [];
      setMySubjects(subjects);

      if (!subjects.length) {
        setStudentEnrollments([]);
        setSelectedSubjectId('');
        studentEnrollmentsRef.current = [];
        selectedSubjectIdRef.current = '';
        return;
      }

      const subjectIds = subjects.map((s: any) => s.id);
      let nextSid = selectedSubjectIdRef.current;
      if (!nextSid || !subjectIds.includes(nextSid)) {
        nextSid = subjects[0]?.id ?? '';
      }
      selectedSubjectIdRef.current = nextSid;
      setSelectedSubjectId(nextSid);

      const { data: enrollments } = await supabase
        .from('student_subjects')
        .select('subject_id, student:students(*, course:courses(*), user:users(*))')
        .in('subject_id', subjectIds);

      const list = enrollments || [];
      studentEnrollmentsRef.current = list;
      setStudentEnrollments(list);
    } finally {
      endLoad();
    }
  }, [user?.id, beginLoad, endLoad]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useSupabaseLiveReload(
    useCallback(async () => {
      await loadAttendanceAnalytics();
    }, [loadAttendanceAnalytics]),
    user?.id ? `live:teacher-attendance:${user.id}` : null,
    ['attendance_records', 'attendance_sessions', 'attendance_access_requests']
  );

  const courseOptions = useMemo(() => {
    const courses = new Map<string, string>();
    (studentEnrollments || []).forEach((record: any) => {
      const student = record.student;
      if (student?.course_id && student?.course?.name) {
        courses.set(student.course_id, student.course.name);
      }
    });
    return sortByLabel(Array.from(courses.entries()).map(([value, label]) => ({ value, label })));
  }, [studentEnrollments]);

  const studentsForSelectedSubject = useMemo(() => {
    if (!selectedSubjectId) return [];

    const byId = new Map<string, any>();
    studentEnrollments
      .filter((record: any) => record.subject_id === selectedSubjectId)
      .forEach((record: any) => {
        const student = record.student;
        if (!student?.id) return;
        if (!byId.has(student.id)) {
          byId.set(student.id, student);
        }
      });

    return sortByStudentName(Array.from(byId.values()));
  }, [studentEnrollments, selectedSubjectId]);

  const sectionFilterOptions = useMemo(
    () => officialSectionFilterOptions(sectionsForStudentFilter(officialSections, studentsForSelectedSubject)),
    [officialSections, studentsForSelectedSubject]
  );

  useEffect(() => {
    clearAttendanceDraftDirty();
    void loadAttendanceForDate({ force: true });
  }, [selectedSubjectId, selectedDate, loadAttendanceForDate]);

  useEffect(() => {
    if (!selectedSubjectId || studentsForSelectedSubject.length === 0) return;
    if (attendanceDraftDirtyRef.current) return;
    void loadAttendanceForDate({ force: true });
  }, [selectedSubjectId, studentsForSelectedSubject.length, loadAttendanceForDate]);

  useEffect(() => {
    analyticsSubjectRef.current = null;
    void loadAttendanceAnalytics();
  }, [selectedSubjectId, studentsForSelectedSubject.length, loadAttendanceAnalytics]);

  const selectedSubject = useMemo(
    () => mySubjects.find((item: any) => item.id === selectedSubjectId) ?? null,
    [mySubjects, selectedSubjectId]
  );

  const noClassDates = useMemo(
    () =>
      new Set(
        attendanceSessions
          .filter((session) => session.session_type === 'no_class')
          .map((session) => session.attendance_date)
      ),
    [attendanceSessions]
  );

  const isNoClassDay = dateSessionType === 'no_class';

  const editAccess = useMemo(
    () =>
      resolveAttendanceEditAccess({
        classDays: selectedSubject?.class_days,
        dateIso: selectedDate,
        sessionType: dateSessionType,
        sessionLocked,
        accessRequest,
      }),
    [selectedSubject?.class_days, selectedDate, dateSessionType, sessionLocked, accessRequest]
  );

  const canEditAttendance = editAccess.canEdit;
  const onScheduledDay = isScheduledClassDay(selectedDate, selectedSubject?.class_days);

  const enrichedAttendance = useMemo(
    () => enrichAttendanceRecords(attendanceHistory, attendanceSessions, noClassDates),
    [attendanceHistory, attendanceSessions, noClassDates]
  );

  const filteredStudents = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    const filtered = studentsForSelectedSubject.filter((student: any) => {
      const fullName = formatPersonDisplayName(student).toLowerCase();
      if (q && !fullName.includes(q)) return false;
      if (filterCourseId && student.course_id !== filterCourseId) return false;
      if (filterYear && (student.grade_level || '') !== filterYear) return false;
      if (!matchesOfficialSectionFilter(student.section_id, filterSection)) return false;
      return true;
    });
    return sortByStudentName(filtered);
  }, [studentsForSelectedSubject, filterSearch, filterCourseId, filterYear, filterSection]);

  const visibleStatusCounts = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let scoreSum = 0;
    filteredStudents.forEach((student: any) => {
      const status = statusByStudent[student.id] || 'absent';
      const score = statusToScore(status);
      scoreSum += score;
      if (status === 'present') present += 1;
      else if (status === 'late') late += 1;
      else absent += 1;
    });
    return { present, late, absent, scoreSum };
  }, [filteredStudents, statusByStudent]);

  const attendanceRateForVisible = useMemo(() => {
    if (!filteredStudents.length) return 0;
    return Math.round((visibleStatusCounts.scoreSum / filteredStudents.length) * 10) / 10;
  }, [visibleStatusCounts.scoreSum, filteredStudents.length]);

  const overallAttendanceRate = useMemo(() => {
    if (!enrichedAttendance.length) return 0;
    const total = enrichedAttendance.reduce((sum, r) => sum + r.score, 0);
    return Math.round((total / enrichedAttendance.length) * 10) / 10;
  }, [enrichedAttendance]);

  const totalSessions = useMemo(() => {
    return new Set(enrichedAttendance.map((record) => record.attendance_date)).size;
  }, [enrichedAttendance]);

  const attendanceTrend = useMemo(() => {
    const byDate = new Map<string, { date: string; scoreSum: number; total: number }>();
    enrichedAttendance.forEach((record) => {
      const key = record.attendance_date;
      const existing = byDate.get(key) || { date: key, scoreSum: 0, total: 0 };
      existing.total += 1;
      existing.scoreSum += record.score;
      byDate.set(key, existing);
    });
    return Array.from(byDate.values())
      .map((row) => ({
        ...row,
        rate: row.total > 0 ? Math.round((row.scoreSum / row.total) * 10) / 10 : 0,
        dateLabel: row.date.slice(5),
      }))
      .slice(-8);
  }, [enrichedAttendance]);

  const attendanceByCourse = useMemo(() => {
    if (!enrichedAttendance.length) return [];

    const studentById = new Map<string, any>();
    studentsForSelectedSubject.forEach((student: any) => {
      studentById.set(student.id, student);
    });

    const courseMap = new Map<string, { course: string; scoreSum: number; total: number }>();
    enrichedAttendance.forEach((record) => {
      const student = studentById.get(record.student_id);
      const courseName = student?.course?.name || 'No course';
      const bucket = courseMap.get(courseName) || { course: courseName, scoreSum: 0, total: 0 };
      bucket.total += 1;
      bucket.scoreSum += record.score;
      courseMap.set(courseName, bucket);
    });

    return Array.from(courseMap.values())
      .map((row) => ({
        ...row,
        rate: row.total > 0 ? Math.round((row.scoreSum / row.total) * 10) / 10 : 0,
      }))
      .sort((a, b) => compareNumeric(b.rate, a.rate));
  }, [enrichedAttendance, studentsForSelectedSubject]);

  const atRiskStudents = useMemo(() => {
    if (!enrichedAttendance.length) return [];

    const studentById = new Map<string, any>();
    studentsForSelectedSubject.forEach((student: any) => {
      studentById.set(student.id, student);
    });

    const summary = summarizeByStudent(enrichedAttendance);

    return Array.from(summary.entries())
      .map(([studentId, stats]) => {
        const student = studentById.get(studentId);
        return {
          studentId,
          name: formatPersonDisplayName(student || {}) || 'Unknown student',
          yearLevel: student?.grade_level || '-',
          section: student ? officialSectionDisplayName(student, sectionsById) : '-',
          rate: stats.averageScore,
          total: stats.total,
          absent: stats.absent,
        };
      })
      .filter((row) => row.total >= 3)
      .filter((row) => row.rate < 75)
      .sort((a, b) => compareNumeric(a.rate, b.rate))
      .slice(0, 6);
  }, [enrichedAttendance, studentsForSelectedSubject, sectionsById]);

  const attendanceBySection = useMemo(() => {
    if (!enrichedAttendance.length) return [];

    const studentById = new Map<string, any>();
    studentsForSelectedSubject.forEach((student: any) => {
      studentById.set(student.id, student);
    });

    const sectionMap = new Map<string, { section: string; scoreSum: number; total: number }>();
    enrichedAttendance.forEach((record) => {
      const student = studentById.get(record.student_id);
      const sectionName = student
        ? officialSectionDisplayName(student, sectionsById)
        : 'No section';
      const bucket = sectionMap.get(sectionName) || { section: sectionName, scoreSum: 0, total: 0 };
      bucket.total += 1;
      bucket.scoreSum += record.score;
      sectionMap.set(sectionName, bucket);
    });

    return Array.from(sectionMap.values())
      .map((row) => ({
        ...row,
        rate: row.total > 0 ? Math.round((row.scoreSum / row.total) * 10) / 10 : 0,
      }))
      .sort((a, b) => compareNumeric(b.rate, a.rate));
  }, [enrichedAttendance, studentsForSelectedSubject, sectionsById]);

  const monthlyAttendanceHeatmap = useMemo(() => {
    const byMonth = new Map<string, { key: string; scoreSum: number; total: number }>();
    enrichedAttendance.forEach((record) => {
      const key = String(record.attendance_date || '').slice(0, 7);
      if (!key) return;
      const bucket = byMonth.get(key) || { key, scoreSum: 0, total: 0 };
      bucket.total += 1;
      bucket.scoreSum += record.score;
      byMonth.set(key, bucket);
    });

    return Array.from(byMonth.values())
      .map((row) => {
        const rate = row.total > 0 ? Math.round((row.scoreSum / row.total) * 10) / 10 : 0;
        const date = new Date(`${row.key}-01`);
        const label = Number.isNaN(date.getTime())
          ? row.key
          : date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
        return {
          ...row,
          rate,
          label,
        };
      })
      .sort((a, b) => compareAlphabetical(a.key, b.key));
  }, [enrichedAttendance]);

  const getHeatLevelClass = (rate: number) => {
    if (rate >= 95) return 'bg-green-700 text-white border-green-800';
    if (rate >= 90) return 'bg-green-600 text-white border-green-700';
    if (rate >= 85) return 'bg-green-500 text-white border-green-600';
    if (rate >= 80) return 'bg-lime-400 text-gray-900 border-lime-500';
    if (rate >= 75) return 'bg-yellow-300 text-gray-900 border-yellow-400';
    if (rate >= 70) return 'bg-orange-300 text-gray-900 border-orange-400';
    return 'bg-red-300 text-red-950 border-red-400';
  };

  const exportAttendanceExcel = () => {
    if (!selectedSubjectId || !attendanceHistory.length) {
      setAppMessage({
        title: 'No data to export',
        message: 'Record attendance first so analytics can be exported.',
        variant: 'warning',
      });
      return;
    }

    const subject = mySubjects.find((item: any) => item.id === selectedSubjectId);
    exportAttendanceWorkbook({
      subjectName: subject?.name || 'subject',
      records: attendanceHistory,
      sessions: attendanceSessions,
      students: studentsForSelectedSubject,
      sectionsById,
      noClassDates,
    });
  };

  const setStatusForVisible = (status: AttendanceStatus) => {
    markAttendanceDraftDirty();
    setStatusByStudent((prev) => {
      const next = { ...prev };
      filteredStudents.forEach((student: any) => {
        next[student.id] = status;
      });
      return next;
    });
  };

  const setStudentStatus = (studentId: string, status: AttendanceStatus) => {
    markAttendanceDraftDirty();
    setStatusByStudent((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const upsertSessionType = async (
    sessionType: AttendanceSessionType,
    options?: { lock?: boolean }
  ) => {
    const payload: Record<string, unknown> = {
      subject_id: selectedSubjectId,
      attendance_date: selectedDate,
      session_type: sessionType,
      quarter: sessionType === 'class' ? selectedQuarter : null,
      marked_by: user?.id || null,
    };
    if (options?.lock) {
      payload.is_locked = true;
      payload.locked_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from('attendance_sessions')
      .upsert(payload, { onConflict: 'subject_id,attendance_date' });
    if (error) throw error;
  };

  const submitAccessRequest = async () => {
    if (!selectedSubjectId) return;
    const reason = accessRequestReason.trim();
    if (!reason) {
      setAppMessage({
        title: 'Reason required',
        message: 'Briefly explain why you need to enter or change attendance for this date.',
        variant: 'warning',
      });
      return;
    }
    if (accessRequest?.status === 'pending') {
      setAppMessage({
        title: 'Request pending',
        message: 'An admin is already reviewing your request for this date.',
        variant: 'info',
      });
      return;
    }

    setRequestingAccess(true);
    try {
      const { error } = await supabase.from('attendance_access_requests').insert({
        subject_id: selectedSubjectId,
        attendance_date: selectedDate,
        requested_by: user?.id || null,
        reason,
        status: 'pending',
      });
      if (error) throw error;
      setShowAccessRequestModal(false);
      setAccessRequestReason('');
      const { data } = await supabase
        .from('attendance_access_requests')
        .select('*')
        .eq('subject_id', selectedSubjectId)
        .eq('attendance_date', selectedDate)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setAccessRequest((data as AttendanceAccessRequest) || null);
      setAppMessage({
        title: 'Request sent',
        message: 'An admin has been notified and can approve access for this date.',
        variant: 'success',
      });
    } catch (error: any) {
      setAppMessage({
        title: 'Request failed',
        message: error?.message || 'Could not submit access request.',
        variant: 'error',
      });
    } finally {
      setRequestingAccess(false);
    }
  };

  const markAsNoClass = async () => {
    if (!selectedSubjectId) return;
    if (!canEditAttendance) {
      setAppMessage({
        title: 'Cannot change',
        message: attendanceEditBlockMessage(editAccess.reason),
        variant: 'warning',
      });
      return;
    }
    setSaving(true);
    try {
      await upsertSessionType('no_class');
      const studentIds = rosterStudentIdsForSubject(selectedSubjectId, studentEnrollments);
      if (studentIds.length) {
        await supabase
          .from('attendance_records')
          .delete()
          .eq('subject_id', selectedSubjectId)
          .eq('attendance_date', selectedDate)
          .in('student_id', studentIds);
      }
      setDateSessionType('no_class');
      clearAttendanceDraftDirty();
      setStatusByStudent({});
      await loadAttendanceAnalytics();
      setAppMessage({
        title: 'No class saved',
        message: `${selectedDate} is recorded as no class. It will not affect attendance rates.`,
        variant: 'success',
      });
    } catch (error: any) {
      setAppMessage({
        title: 'Could not save',
        message: error?.message?.includes('row-level security') ||
          error?.message?.includes('attendance_sessions')
          ? 'Run migrations 20260519120000_attendance_scores_quarter.sql and 20260519130000_attendance_sessions_rls_hotfix.sql in Supabase SQL Editor, then try again.'
          : error?.message || 'Please try again.',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const markAsClassDay = async () => {
    if (!selectedSubjectId) return;
    const approvedUnused =
      accessRequest?.status === 'approved' && !accessRequest.used_at;
    if (isNoClassDay) {
      if (!onScheduledDay && !approvedUnused) {
        setAppMessage({
          title: 'Cannot change',
          message: attendanceEditBlockMessage('off_schedule'),
          variant: 'warning',
        });
        return;
      }
    } else if (!canEditAttendance) {
      setAppMessage({
        title: 'Cannot change',
        message: attendanceEditBlockMessage(editAccess.reason),
        variant: 'warning',
      });
      return;
    }
    setSaving(true);
    try {
      await upsertSessionType('class');
      setDateSessionType('class');
      clearAttendanceDraftDirty();
      await loadAttendanceForDate({ force: true });
      await loadAttendanceAnalytics();
      setAppMessage({
        title: 'Class day',
        message: `You can now mark attendance for ${selectedDate}.`,
        variant: 'success',
      });
    } catch (error: any) {
      setAppMessage({
        title: 'Could not save',
        message: error?.message || 'Please try again.',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const saveAttendance = async () => {
    if (!selectedSubjectId) return;
    if (!canEditAttendance) {
      setAppMessage({
        title: 'Attendance locked',
        message: attendanceEditBlockMessage(editAccess.reason),
        variant: 'warning',
      });
      return;
    }
    if (isNoClassDay) {
      setAppMessage({
        title: 'No class day',
        message: 'This date is marked as no class. Click "Mark as class day" first if you need to take attendance.',
        variant: 'warning',
      });
      return;
    }
    if (!studentsForSelectedSubject.length) {
      setAppMessage({ title: 'No students', message: 'No enrolled students found for this subject.', variant: 'warning' });
      return;
    }

    setSaving(true);
    try {
      await upsertSessionType('class', { lock: true });

      const payload = studentsForSelectedSubject.map((student: any) => {
        const status = statusByStudent[student.id] || 'absent';
        const score = statusToScore(status);
        return {
          subject_id: selectedSubjectId,
          student_id: student.id,
          attendance_date: selectedDate,
          score,
          is_present: status === 'present',
          marked_by: user?.id || null,
        };
      });

      const { error } = await supabase
        .from('attendance_records')
        .upsert(payload, { onConflict: 'subject_id,student_id,attendance_date' });

      if (error) throw error;

      if (accessRequest?.status === 'approved' && accessRequest.id) {
        await supabase
          .from('attendance_access_requests')
          .update({ used_at: new Date().toISOString() })
          .eq('id', accessRequest.id);
      }

      setSessionLocked(true);
      clearAttendanceDraftDirty();
      await loadAttendanceForDate({ force: true });
      await loadAttendanceAnalytics();
      setAppMessage({
        title: 'Attendance saved',
        message: `Attendance for ${selectedDate} has been saved and locked.`,
        variant: 'success',
      });
    } catch (error: any) {
      const msg = String(error?.message || '');
      setAppMessage({
        title: 'Save failed',
        message:
          msg.includes('row-level security') || msg.includes('attendance_sessions')
            ? 'Run migrations 20260519120000_attendance_scores_quarter.sql and 20260519130000_attendance_sessions_rls_hotfix.sql in Supabase SQL Editor, then try again.'
            : msg || 'Attendance could not be saved. Please try again.',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Attendance">
        <PageSkeletonLoader rows={5} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Attendance">
      <GlassCard variant="plain" className="mb-6 p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-[#800000]">Attendance filters</h2>

        <p className="mb-3 text-sm text-gray-600">
          Scoring: <span className="font-semibold text-green-700">Present = 100</span>
          {' · '}
          <span className="font-semibold text-amber-700">Late = 50</span>
          {' · '}
          <span className="font-semibold text-red-700">Absent = 0</span>
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7">
          <Select
            label="Subject"
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            options={
              mySubjects.length
                ? sortByLabel(
                    sortByName(mySubjects).map((subject: any) => ({
                      value: subject.id,
                      label: `${subject.name} - ${subject.course?.name || 'No course'}`,
                    }))
                  )
                : [{ value: '', label: 'No subjects assigned' }]
            }
          />
          <Select
            label="Course"
            value={filterCourseId}
            onChange={(e) => setFilterCourseId(e.target.value)}
            options={sortSelectOptions([{ value: '', label: 'All courses' }, ...courseOptions], [''])}
          />
          <Select
            label="Grade level"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            options={[
              { value: '', label: 'All year levels' },
              { value: '1st', label: '1st Year' },
              { value: '2nd', label: '2nd Year' },
              { value: '3rd', label: '3rd Year' },
              { value: '4th', label: '4th Year' },
            ]}
          />
          <Select
            label="Section"
            value={filterSection}
            onChange={(e) => setFilterSection(e.target.value)}
            options={sectionFilterOptions}
          />
          <div className="space-y-1">
            <label htmlFor="attendance-search" className="ml-1 block text-sm font-medium text-gray-700">
              Search student
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden>
                <Search className="h-4 w-4 shrink-0" strokeWidth={2} />
              </span>
              <input
                id="attendance-search"
                type="search"
                placeholder="Type student name..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="w-full rounded-xl border border-gray-300/70 bg-white px-10 py-2.5 text-base text-gray-900 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/50 hover:border-gray-400/80"
              />
            </div>
          </div>
          <Select
            label="Period"
            value={String(selectedQuarter)}
            onChange={(e) => setSelectedQuarter(Number(e.target.value))}
            options={ATTENDANCE_QUARTERS.map((q) => ({ value: String(q.value), label: q.label }))}
          />
          <div className="space-y-1">
            <label htmlFor="attendance-date" className="ml-1 block text-sm font-medium text-gray-700">
              Attendance date
            </label>
            <input
              id="attendance-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-xl border border-gray-300/70 bg-white px-4 py-2.5 text-base text-gray-900 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/50 hover:border-gray-400/80"
            />
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-600">
          Class schedule:{' '}
          <span className="font-semibold text-[#800000]">
            {formatClassDaysLabel(selectedSubject?.class_days)}
          </span>
          {!onScheduledDay && selectedSubject?.class_days && (
            <span className="ml-2 font-medium text-amber-700">· Selected date is not on the weekly schedule</span>
          )}
        </p>
        {!canEditAttendance && !isNoClassDay && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">{sessionLocked ? 'Attendance locked' : 'Editing restricted'}</p>
            <p className="mt-1">{attendanceEditBlockMessage(editAccess.reason)}</p>
            {editAccess.reason !== 'pending_access' && (
              <Button
                type="button"
                className="mt-3"
                onClick={() => setShowAccessRequestModal(true)}
                disabled={requestingAccess}
              >
                <SendHorizonal className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                Request admin access
              </Button>
            )}
          </div>
        )}
        {sessionLocked && canEditAttendance && (
          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-emerald-800">
            <Lock className="h-4 w-4 shrink-0" aria-hidden />
            Admin approved — you can edit once; saving will lock again.
          </p>
        )}
      </GlassCard>

      <GlassCard variant="plain" className="p-4 sm:p-6">
        <div className="mb-4 flex justify-end">
          <Button type="button" variant="secondary" onClick={exportAttendanceExcel}>
            <Download className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            Export Excel (2 sheets)
          </Button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-600">Selected date attendance</p>
            {isNoClassDay ? (
              <>
                <p className="text-2xl font-bold text-gray-600">No class</p>
                <p className="text-xs text-gray-500">Not counted in attendance rates</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-[#800000]">{attendanceRateForVisible}</p>
                <p className="text-xs text-gray-500">
                  {visibleStatusCounts.present} present · {visibleStatusCounts.late} late · {visibleStatusCounts.absent} absent
                </p>
              </>
            )}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-600">Overall avg score</p>
            <p className="text-2xl font-bold text-[#800000]">{overallAttendanceRate}</p>
            <p className="text-xs text-gray-500">100 = present, 50 = late, 0 = absent</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-600">Recorded sessions</p>
            <p className="text-2xl font-bold text-[#800000]">{totalSessions}</p>
            <p className="text-xs text-gray-500">Unique attendance dates</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-600">At-risk learners</p>
            <p className="text-2xl font-bold text-[#800000]">{atRiskStudents.length}</p>
            <p className="text-xs text-gray-500">Avg score below 75 with 3+ records</p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <h3 className="mb-2 text-base font-semibold text-[#800000]">Attendance trend (latest sessions)</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attendanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="dateLabel" tick={{ fill: '#4b5563', fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#4b5563', fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="rate" stroke="#800000" strokeWidth={2} name="Avg score" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <h3 className="mb-2 text-base font-semibold text-[#800000]">Attendance by course</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceByCourse}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="course" tick={{ fill: '#4b5563', fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#4b5563', fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="rate" fill="#800000" name="Avg score" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <h3 className="mb-2 text-base font-semibold text-[#800000]">Attendance by section</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceBySection}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="section" tick={{ fill: '#4b5563', fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#4b5563', fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="rate" fill="#d97706" name="Avg score" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <h3 className="mb-2 text-base font-semibold text-[#800000]">Monthly attendance heatmap</h3>
            {monthlyAttendanceHeatmap.length === 0 ? (
              <p className="text-sm text-gray-500">No attendance records yet for monthly trend.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {monthlyAttendanceHeatmap.map((month) => (
                  <div
                    key={month.key}
                    className={`rounded-xl border px-3 py-2 ${getHeatLevelClass(month.rate)}`}
                    title={`${month.label}: avg score ${month.rate} (${month.total} records)`}
                  >
                    <p className="text-xs font-medium">{month.label}</p>
                    <p className="text-lg font-bold">{month.rate}%</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-base font-semibold text-[#800000]">Students needing attendance support</h3>
          {analyticsLoading ? (
            <p className="text-sm text-gray-500">Loading attendance analytics...</p>
          ) : atRiskStudents.length === 0 ? (
            <p className="text-sm text-gray-500">No at-risk students based on current attendance records.</p>
          ) : (
            <div className="space-y-2">
              {atRiskStudents.map((student) => (
                <div key={student.studentId} className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                  <div className="flex items-center gap-2 text-sm text-red-900">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="font-medium">{student.name}</span>
                    <span className="text-red-700">
                      ({student.yearLevel} - {student.section})
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-red-800">{student.rate} avg</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#800000]">Class attendance table</h2>
            {isNoClassDay ? (
              <p className="text-sm text-gray-600">
                This date is marked as <span className="font-semibold text-gray-800">No class</span>.
              </p>
            ) : (
              <p className="text-sm text-gray-600">
                {ATTENDANCE_QUARTERS.find((q) => q.value === selectedQuarter)?.label ?? 'Period'} ·{' '}
                {visibleStatusCounts.present} present · {visibleStatusCounts.late} late · {visibleStatusCounts.absent} absent
                {sessionLocked && !canEditAttendance && (
                  <span className="ml-2 font-semibold text-gray-700">· Locked</span>
                )}
                {hasUnsavedAttendance && canEditAttendance && (
                  <span className="ml-2 font-semibold text-amber-700">· Unsaved — click Save attendance</span>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {isNoClassDay ? (
              <Button type="button" disabled={saving} onClick={() => void markAsClassDay()}>
                Mark as class day
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  disabled={!canEditAttendance}
                  onClick={() => setStatusForVisible('present')}
                >
                  <Check className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  All Present
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!canEditAttendance}
                  onClick={() => setStatusForVisible('late')}
                >
                  All Late
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!canEditAttendance}
                  onClick={() => setStatusForVisible('absent')}
                >
                  All Absent
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving || !canEditAttendance}
                  onClick={() => void markAsNoClass()}
                >
                  No class
                </Button>
                <Button type="button" disabled={saving || !canEditAttendance} onClick={() => void saveAttendance()}>
                  <Save className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  {saving ? 'Saving...' : sessionLocked && canEditAttendance ? 'Save & re-lock' : 'Save attendance'}
                </Button>
                {!canEditAttendance && editAccess.reason !== 'pending_access' && (
                  <Button type="button" variant="secondary" onClick={() => setShowAccessRequestModal(true)}>
                    <SendHorizonal className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                    Request access
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {isNoClassDay ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-8 text-center">
            <p className="text-base font-semibold text-gray-800">No class for {selectedDate}</p>
            <p className="mt-2 text-sm text-gray-600">
              Use this on days without class (e.g. Tuesday for an MWF subject). Click &quot;Mark as class day&quot; when you need to take attendance.
            </p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <p className="py-8 text-center text-gray-500">No students match your selected subject and filters.</p>
        ) : (
          <div className="-mx-1 overflow-x-auto rounded-xl [scrollbar-width:thin] sm:mx-0">
            <table className="w-full min-w-max text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-gray-700">Student</th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-gray-700">Course</th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-gray-700">Grade Level</th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-gray-700">Section</th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-gray-700">Status (score)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.map((student: any) => {
                  const status = statusByStudent[student.id] || 'absent';
                  const score = statusToScore(status);
                  return (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 shrink-0 text-[#800000]" strokeWidth={2} aria-hidden />
                          <span className="font-medium">{formatPersonDisplayName(student)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{student.course?.name || '-'}</td>
                      <td className="px-4 py-3 text-gray-700">{student.grade_level || '-'}</td>
                      <td className="px-4 py-3 text-gray-700">{officialSectionDisplayName(student, sectionsById)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {(['present', 'late', 'absent'] as AttendanceStatus[]).map((option) => (
                            <label
                              key={option}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${
                                canEditAttendance ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                              } ${
                                status === option
                                  ? option === 'present'
                                    ? 'border-green-600 bg-green-50 text-green-800'
                                    : option === 'late'
                                      ? 'border-amber-500 bg-amber-50 text-amber-900'
                                      : 'border-red-400 bg-red-50 text-red-800'
                                  : 'border-gray-200 bg-white text-gray-600'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`attendance-${student.id}`}
                                checked={status === option}
                                disabled={!canEditAttendance}
                                onChange={() => setStudentStatus(student.id, option)}
                                className="sr-only"
                              />
                              {option === 'present' ? 'Present' : option === 'late' ? 'Late' : 'Absent'} ({statusToScore(option)})
                            </label>
                          ))}
                          <span className="text-xs font-semibold text-gray-500">= {score}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
      <Modal
        isOpen={showAccessRequestModal}
        onClose={() => setShowAccessRequestModal(false)}
        title="Request attendance access"
      >
        <p className="mb-3 text-sm text-gray-600">
          Explain why you need to enter or change attendance for{' '}
          <span className="font-semibold">{selectedDate}</span>
          {selectedSubject?.name ? ` (${selectedSubject.name})` : ''}. An admin will be notified.
        </p>
        <label htmlFor="access-reason" className="ml-1 block text-sm font-medium text-gray-700">
          Reason
        </label>
        <textarea
          id="access-reason"
          rows={4}
          value={accessRequestReason}
          onChange={(e) => setAccessRequestReason(e.target.value)}
          placeholder="e.g. Forgot to mark Friday attendance; class was moved to this date."
          className="mt-1 w-full rounded-xl border border-gray-300/70 bg-white px-4 py-2.5 text-base text-gray-900 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/50"
        />
        <div className="mt-4 flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowAccessRequestModal(false)}>
            Cancel
          </Button>
          <Button type="button" className="flex-1" disabled={requestingAccess} onClick={() => void submitAccessRequest()}>
            {requestingAccess ? 'Sending…' : 'Send request'}
          </Button>
        </div>
      </Modal>

      {appMessage && (
        <MessageModal
          isOpen
          onClose={() => setAppMessage(null)}
          title={appMessage.title}
          message={appMessage.message}
          variant={appMessage.variant}
        />
      )}
    </DashboardLayout>
  );
}
