import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Download, Save, Search, Users } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Select, Button, MessageModal, PageSkeletonLoader, type AppMessagePayload } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase } from '../../lib/supabase';
import { useSupabaseLiveReload } from '../../lib/useSupabaseLiveReload';
import { useInitialPageLoading } from '../../lib/useInitialPageLoading';
import { formatClassDaysLabel, isScheduledClassDay } from '../../lib/classSchedule';
import { SCHOOL_SECTION_SELECT_OPTIONS, normalizeSchoolSection } from '../../constants/schoolSections';
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
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [presentByStudent, setPresentByStudent] = useState<Record<string, boolean>>({});
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const analyticsSubjectRef = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [appMessage, setAppMessage] = useState<AppMessagePayload | null>(null);

  const selectedSubjectIdRef = useRef(selectedSubjectId);
  const selectedDateRef = useRef(selectedDate);
  const studentEnrollmentsRef = useRef(studentEnrollments);
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

  const loadAttendanceForDate = useCallback(async () => {
    const sid = selectedSubjectIdRef.current;
    const d = selectedDateRef.current;
    const enrollments = studentEnrollmentsRef.current;
    if (!sid) {
      setPresentByStudent({});
      return;
    }

    const studentIds = rosterStudentIdsForSubject(sid, enrollments);
    if (!studentIds.length) {
      setPresentByStudent({});
      return;
    }

    const { data, error } = await supabase
      .from('attendance_records')
      .select('student_id, is_present')
      .eq('subject_id', sid)
      .eq('attendance_date', d)
      .in('student_id', studentIds);

    if (error) {
      setAppMessage({
        title: 'Attendance table missing',
        message: 'Please run the new Supabase migration, then reload this page.',
        variant: 'warning',
      });
      setPresentByStudent({});
      return;
    }

    const nextMap: Record<string, boolean> = {};
    studentIds.forEach((studentId: string) => {
      nextMap[studentId] = false;
    });
    (data || []).forEach((record: any) => {
      nextMap[record.student_id] = Boolean(record.is_present);
    });
    setPresentByStudent(nextMap);
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
    const { data, error } = await supabase
      .from('attendance_records')
      .select('student_id, is_present, attendance_date')
      .eq('subject_id', sid)
      .in('student_id', studentIds)
      .order('attendance_date', { ascending: true });

    if (error) {
      setAttendanceHistory([]);
      setAnalyticsLoading(false);
      return;
    }

    setAttendanceHistory(data || []);
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
      await loadData();
      await new Promise((r) => setTimeout(r, 0));
      await loadAttendanceForDate();
      await loadAttendanceAnalytics();
    }, [loadData, loadAttendanceForDate, loadAttendanceAnalytics]),
    user?.id ? `live:teacher-attendance:${user.id}` : null,
    ['attendance_records', 'student_subjects', 'subjects', 'students']
  );

  const courseOptions = useMemo(() => {
    const courses = new Map<string, string>();
    (studentEnrollments || []).forEach((record: any) => {
      const student = record.student;
      if (student?.course_id && student?.course?.name) {
        courses.set(student.course_id, student.course.name);
      }
    });
    return Array.from(courses.entries()).map(([value, label]) => ({ value, label }));
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

    return Array.from(byId.values());
  }, [studentEnrollments, selectedSubjectId]);

  useEffect(() => {
    void loadAttendanceForDate();
  }, [selectedSubjectId, selectedDate, studentsForSelectedSubject.length, loadAttendanceForDate]);

  useEffect(() => {
    analyticsSubjectRef.current = null;
    void loadAttendanceAnalytics();
  }, [selectedSubjectId, studentsForSelectedSubject.length, loadAttendanceAnalytics]);

  const selectedSubject = useMemo(
    () => mySubjects.find((item: any) => item.id === selectedSubjectId) ?? null,
    [mySubjects, selectedSubjectId]
  );

  const isClassDayForSelectedDate = useMemo(
    () => isScheduledClassDay(selectedDate, selectedSubject?.class_days),
    [selectedDate, selectedSubject?.class_days]
  );

  const scheduledAttendanceHistory = useMemo(() => {
    const pattern = selectedSubject?.class_days;
    if (!pattern) return attendanceHistory;
    return attendanceHistory.filter((record) => isScheduledClassDay(record.attendance_date, pattern));
  }, [attendanceHistory, selectedSubject?.class_days]);

  const filteredStudents = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return studentsForSelectedSubject.filter((student: any) => {
      const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim().toLowerCase();
      if (q && !fullName.includes(q)) return false;
      if (filterCourseId && student.course_id !== filterCourseId) return false;
      if (filterYear && (student.grade_level || '') !== filterYear) return false;
      if (filterSection && normalizeSchoolSection(student.section) !== filterSection) return false;
      return true;
    });
  }, [studentsForSelectedSubject, filterSearch, filterCourseId, filterYear, filterSection]);

  const presentCount = useMemo(() => {
    return filteredStudents.filter((student: any) => presentByStudent[student.id]).length;
  }, [filteredStudents, presentByStudent]);

  const attendanceRateForVisible = useMemo(() => {
    if (!filteredStudents.length) return 0;
    return Math.round((presentCount / filteredStudents.length) * 1000) / 10;
  }, [presentCount, filteredStudents.length]);

  const overallAttendanceRate = useMemo(() => {
    if (!scheduledAttendanceHistory.length) return 0;
    const present = scheduledAttendanceHistory.filter((record) => Boolean(record.is_present)).length;
    return Math.round((present / scheduledAttendanceHistory.length) * 1000) / 10;
  }, [scheduledAttendanceHistory]);

  const totalSessions = useMemo(() => {
    return new Set(scheduledAttendanceHistory.map((record) => record.attendance_date)).size;
  }, [scheduledAttendanceHistory]);

  const attendanceTrend = useMemo(() => {
    const byDate = new Map<string, { date: string; present: number; total: number }>();
    scheduledAttendanceHistory.forEach((record) => {
      const key = record.attendance_date;
      const existing = byDate.get(key) || { date: key, present: 0, total: 0 };
      existing.total += 1;
      if (record.is_present) existing.present += 1;
      byDate.set(key, existing);
    });
    return Array.from(byDate.values())
      .map((row) => ({
        ...row,
        rate: row.total > 0 ? Math.round((row.present / row.total) * 1000) / 10 : 0,
        dateLabel: row.date.slice(5),
      }))
      .slice(-8);
  }, [scheduledAttendanceHistory]);

  const attendanceByCourse = useMemo(() => {
    if (!scheduledAttendanceHistory.length) return [];

    const studentById = new Map<string, any>();
    studentsForSelectedSubject.forEach((student: any) => {
      studentById.set(student.id, student);
    });

    const courseMap = new Map<string, { course: string; present: number; total: number }>();
    scheduledAttendanceHistory.forEach((record) => {
      const student = studentById.get(record.student_id);
      const courseName = student?.course?.name || 'No course';
      const bucket = courseMap.get(courseName) || { course: courseName, present: 0, total: 0 };
      bucket.total += 1;
      if (record.is_present) bucket.present += 1;
      courseMap.set(courseName, bucket);
    });

    return Array.from(courseMap.values())
      .map((row) => ({
        ...row,
        rate: row.total > 0 ? Math.round((row.present / row.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.rate - a.rate);
  }, [scheduledAttendanceHistory, studentsForSelectedSubject]);

  const atRiskStudents = useMemo(() => {
    if (!scheduledAttendanceHistory.length) return [];

    const studentById = new Map<string, any>();
    studentsForSelectedSubject.forEach((student: any) => {
      studentById.set(student.id, student);
    });

    const byStudent = new Map<string, { present: number; total: number }>();
    scheduledAttendanceHistory.forEach((record) => {
      const bucket = byStudent.get(record.student_id) || { present: 0, total: 0 };
      bucket.total += 1;
      if (record.is_present) bucket.present += 1;
      byStudent.set(record.student_id, bucket);
    });

    return Array.from(byStudent.entries())
      .map(([studentId, stats]) => {
        const student = studentById.get(studentId);
        const rate = stats.total > 0 ? Math.round((stats.present / stats.total) * 1000) / 10 : 0;
        return {
          studentId,
          name: `${student?.first_name || ''} ${student?.last_name || ''}`.trim() || 'Unknown student',
          yearLevel: student?.grade_level || '-',
          section: student?.section || '-',
          rate,
          total: stats.total,
        };
      })
      .filter((row) => row.total >= 3)
      .filter((row) => row.rate < 75)
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 6);
  }, [scheduledAttendanceHistory, studentsForSelectedSubject]);

  const attendanceBySection = useMemo(() => {
    if (!scheduledAttendanceHistory.length) return [];

    const studentById = new Map<string, any>();
    studentsForSelectedSubject.forEach((student: any) => {
      studentById.set(student.id, student);
    });

    const sectionMap = new Map<string, { section: string; present: number; total: number }>();
    scheduledAttendanceHistory.forEach((record) => {
      const student = studentById.get(record.student_id);
      const sectionName = normalizeSchoolSection(student?.section) || 'No section';
      const bucket = sectionMap.get(sectionName) || { section: sectionName, present: 0, total: 0 };
      bucket.total += 1;
      if (record.is_present) bucket.present += 1;
      sectionMap.set(sectionName, bucket);
    });

    return Array.from(sectionMap.values())
      .map((row) => ({
        ...row,
        rate: row.total > 0 ? Math.round((row.present / row.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.rate - a.rate);
  }, [scheduledAttendanceHistory, studentsForSelectedSubject]);

  const monthlyAttendanceHeatmap = useMemo(() => {
    const byMonth = new Map<string, { key: string; present: number; total: number }>();
    scheduledAttendanceHistory.forEach((record) => {
      const key = String(record.attendance_date || '').slice(0, 7);
      if (!key) return;
      const bucket = byMonth.get(key) || { key, present: 0, total: 0 };
      bucket.total += 1;
      if (record.is_present) bucket.present += 1;
      byMonth.set(key, bucket);
    });

    return Array.from(byMonth.values())
      .map((row) => {
        const rate = row.total > 0 ? Math.round((row.present / row.total) * 1000) / 10 : 0;
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
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [scheduledAttendanceHistory]);

  const getHeatLevelClass = (rate: number) => {
    if (rate >= 95) return 'bg-green-700 text-white border-green-800';
    if (rate >= 90) return 'bg-green-600 text-white border-green-700';
    if (rate >= 85) return 'bg-green-500 text-white border-green-600';
    if (rate >= 80) return 'bg-lime-400 text-gray-900 border-lime-500';
    if (rate >= 75) return 'bg-yellow-300 text-gray-900 border-yellow-400';
    if (rate >= 70) return 'bg-orange-300 text-gray-900 border-orange-400';
    return 'bg-red-300 text-red-950 border-red-400';
  };

  const exportAttendanceAnalyticsCsv = () => {
    if (!selectedSubjectId || !attendanceHistory.length) {
      setAppMessage({
        title: 'No data to export',
        message: 'Record attendance first so analytics can be exported.',
        variant: 'warning',
      });
      return;
    }

    const subject = mySubjects.find((item: any) => item.id === selectedSubjectId);
    const subjectName = subject?.name || 'subject';
    const studentById = new Map<string, any>();
    studentsForSelectedSubject.forEach((student: any) => {
      studentById.set(student.id, student);
    });

    const sanitizeCsv = (value: unknown) => {
      const text = String(value ?? '');
      if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const rows = [
      ['subject', 'attendance_date', 'student_name', 'course', 'year_level', 'section', 'is_present'],
      ...attendanceHistory.map((record) => {
        const student = studentById.get(record.student_id);
        return [
          subjectName,
          record.attendance_date,
          `${student?.first_name || ''} ${student?.last_name || ''}`.trim(),
          student?.course?.name || '',
          student?.grade_level || '',
          normalizeSchoolSection(student?.section) || '',
          record.is_present ? 'Present' : 'Absent',
        ];
      }),
    ];

    const csv = rows.map((row) => row.map((cell) => sanitizeCsv(cell)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-analytics-${subjectName.replace(/\s+/g, '-').toLowerCase()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const setPresentForVisible = (value: boolean) => {
    setPresentByStudent((prev) => {
      const next = { ...prev };
      filteredStudents.forEach((student: any) => {
        next[student.id] = value;
      });
      return next;
    });
  };

  const togglePresent = (studentId: string, value: boolean) => {
    setPresentByStudent((prev) => ({
      ...prev,
      [studentId]: value,
    }));
  };

  const saveAttendance = async () => {
    if (!selectedSubjectId) return;
    if (!isClassDayForSelectedDate) {
      setAppMessage({
        title: 'No class today',
        message: `This subject meets on ${formatClassDaysLabel(selectedSubject?.class_days)} only. Pick a scheduled class day to mark attendance.`,
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
      const payload = studentsForSelectedSubject.map((student: any) => ({
        subject_id: selectedSubjectId,
        student_id: student.id,
        attendance_date: selectedDate,
        is_present: Boolean(presentByStudent[student.id]),
        marked_by: user?.id || null,
      }));

      const { error } = await supabase
        .from('attendance_records')
        .upsert(payload, { onConflict: 'subject_id,student_id,attendance_date' });

      if (error) throw error;

      setAppMessage({
        title: 'Attendance saved',
        message: `Attendance for ${selectedDate} has been saved.`,
        variant: 'success',
      });
    } catch (error: any) {
      setAppMessage({
        title: 'Save failed',
        message: error?.message || 'Attendance could not be saved. Please try again.',
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <Select
            label="Subject"
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            options={
              mySubjects.length
                ? mySubjects.map((subject: any) => ({
                    value: subject.id,
                    label: `${subject.name} - ${subject.course?.name || 'No course'}`,
                  }))
                : [{ value: '', label: 'No subjects assigned' }]
            }
          />
          <Select
            label="Course"
            value={filterCourseId}
            onChange={(e) => setFilterCourseId(e.target.value)}
            options={[{ value: '', label: 'All courses' }, ...courseOptions]}
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
            options={[{ value: '', label: 'All sections' }, ...SCHOOL_SECTION_SELECT_OPTIONS]}
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
        {selectedSubject?.class_days && (
          <p className="mt-3 text-sm text-gray-600">
            Class schedule: <span className="font-semibold text-[#800000]">{formatClassDaysLabel(selectedSubject.class_days)}</span>
          </p>
        )}
        {!isClassDayForSelectedDate && selectedSubject?.class_days && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {selectedDate} is not a scheduled class day for this subject. Attendance marking is disabled; analytics only count scheduled class days.
          </p>
        )}
      </GlassCard>

      <GlassCard variant="plain" className="p-4 sm:p-6">
        <div className="mb-4 flex justify-end">
          <Button type="button" variant="secondary" onClick={exportAttendanceAnalyticsCsv}>
            <Download className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            Export analytics CSV
          </Button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-600">Selected date attendance</p>
            <p className="text-2xl font-bold text-[#800000]">{attendanceRateForVisible}%</p>
            <p className="text-xs text-gray-500">
              {presentCount} present, {Math.max(filteredStudents.length - presentCount, 0)} absent
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-600">Overall subject attendance</p>
            <p className="text-2xl font-bold text-[#800000]">{overallAttendanceRate}%</p>
            <p className="text-xs text-gray-500">Across all recorded sessions</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-600">Recorded sessions</p>
            <p className="text-2xl font-bold text-[#800000]">{totalSessions}</p>
            <p className="text-xs text-gray-500">Unique attendance dates</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-600">At-risk learners</p>
            <p className="text-2xl font-bold text-[#800000]">{atRiskStudents.length}</p>
            <p className="text-xs text-gray-500">Below 75% with at least 3 records</p>
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
                  <Line type="monotone" dataKey="rate" stroke="#800000" strokeWidth={2} name="Attendance %" />
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
                  <Bar dataKey="rate" fill="#800000" name="Attendance %" />
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
                  <Bar dataKey="rate" fill="#d97706" name="Attendance %" />
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
                    title={`${month.label}: ${month.rate}% (${month.present}/${month.total})`}
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
                  <span className="text-sm font-semibold text-red-800">{student.rate}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#800000]">Class attendance table</h2>
            <p className="text-sm text-gray-600">
              Present: <span className="font-semibold text-[#800000]">{presentCount}</span> / {filteredStudents.length}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!isClassDayForSelectedDate} onClick={() => setPresentForVisible(true)}>
              <Check className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              Present All
            </Button>
            <Button type="button" variant="secondary" disabled={!isClassDayForSelectedDate} onClick={() => setPresentForVisible(false)}>
              Clear all
            </Button>
            <Button type="button" disabled={saving || !isClassDayForSelectedDate} onClick={() => void saveAttendance()}>
              <Save className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              {saving ? 'Saving...' : 'Save attendance'}
            </Button>
          </div>
        </div>

        {filteredStudents.length === 0 ? (
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
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-gray-700">Present</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.map((student: any) => {
                  const isPresent = Boolean(presentByStudent[student.id]);
                  return (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 shrink-0 text-[#800000]" strokeWidth={2} aria-hidden />
                          <span className="font-medium">
                            {student.first_name} {student.last_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{student.course?.name || '-'}</td>
                      <td className="px-4 py-3 text-gray-700">{student.grade_level || '-'}</td>
                      <td className="px-4 py-3 text-gray-700">{student.section || '-'}</td>
                      <td className="px-4 py-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={isPresent}
                            disabled={!isClassDayForSelectedDate}
                            onChange={(e) => togglePresent(student.id, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-[#800000] focus:ring-[#800000] disabled:cursor-not-allowed disabled:opacity-50"
                          />
                          {isPresent ? 'Present' : 'Absent'}
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
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
