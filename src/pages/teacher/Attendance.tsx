import { useEffect, useMemo, useState } from 'react';
import { Check, Save, Search, Users } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Select, Button, MessageModal, PageSkeletonLoader, type AppMessagePayload } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase } from '../../lib/supabase';
import { SCHOOL_SECTION_SELECT_OPTIONS, normalizeSchoolSection } from '../../constants/schoolSections';

export default function TeacherAttendancePage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [studentEnrollments, setStudentEnrollments] = useState<any[]>([]);

  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [filterCourseId, setFilterCourseId] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [presentByStudent, setPresentByStudent] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [appMessage, setAppMessage] = useState<AppMessagePayload | null>(null);

  useEffect(() => {
    void loadData();
  }, [user?.id]);

  const loadData = async () => {
    setLoading(true);
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
        return;
      }

      const initialSubjectId = subjects[0]?.id ?? '';
      setSelectedSubjectId(initialSubjectId);

      const { data: enrollments } = await supabase
        .from('student_subjects')
        .select('subject_id, student:students(*, course:courses(*), user:users(*))')
        .in('subject_id', subjects.map((s: any) => s.id));

      setStudentEnrollments(enrollments || []);
    } finally {
      setLoading(false);
    }
  };

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
  }, [selectedSubjectId, selectedDate, studentsForSelectedSubject.length]);

  const loadAttendanceForDate = async () => {
    if (!selectedSubjectId) {
      setPresentByStudent({});
      return;
    }

    const studentIds = studentsForSelectedSubject.map((student: any) => student.id);
    if (!studentIds.length) {
      setPresentByStudent({});
      return;
    }

    const { data, error } = await supabase
      .from('attendance_records')
      .select('student_id, is_present')
      .eq('subject_id', selectedSubjectId)
      .eq('attendance_date', selectedDate)
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
  };

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
      </GlassCard>

      <GlassCard variant="plain" className="p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#800000]">Class attendance table</h2>
            <p className="text-sm text-gray-600">
              Present: <span className="font-semibold text-[#800000]">{presentCount}</span> / {filteredStudents.length}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setPresentForVisible(true)}>
              <Check className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              Present All
            </Button>
            <Button type="button" variant="secondary" onClick={() => setPresentForVisible(false)}>
              Clear all
            </Button>
            <Button type="button" disabled={saving} onClick={() => void saveAttendance()}>
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
                            onChange={(e) => togglePresent(student.id, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-[#800000] focus:ring-[#800000]"
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
