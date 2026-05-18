import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSupabaseLiveReload } from '../../lib/useSupabaseLiveReload';
import { BookUser, GraduationCap, ListFilter, RefreshCw, Search, UserRound } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Badge, Table, Button, Select, PageSkeletonLoader } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, getGradeStatus } from '../../lib/supabase';
import { formatPersonDisplayName } from '../../lib/personName';
import {
  fetchActiveOfficialSections,
  matchesOfficialSectionFilter,
  officialSectionDisplayName,
  officialSectionFilterOptions,
  sectionsForStudentFilter,
  type OfficialSection,
} from '../../lib/officialSections';
import { compareNumeric, sortByLabel, sortByName, sortByStudentName, sortSelectOptions } from '../../lib/sortUtils';

const yearLevelRank = (value?: string | null) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized.startsWith('1')) return 1;
  if (normalized.startsWith('2')) return 2;
  if (normalized.startsWith('3')) return 3;
  if (normalized.startsWith('4')) return 4;
  return 0;
};

export default function TeacherStudentsPage() {
  const { user } = useAuthStore();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [studentGrades, setStudentGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterSearch, setFilterSearch] = useState('');
  const [filterCourseId, setFilterCourseId] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [officialSections, setOfficialSections] = useState<OfficialSection[]>([]);

  useEffect(() => {
    void fetchActiveOfficialSections().then(setOfficialSections);
  }, []);

  const sectionsById = useMemo(
    () => new Map(officialSections.map((s) => [s.id, s])),
    [officialSections]
  );

  const sectionFilterOptions = useMemo(
    () => officialSectionFilterOptions(sectionsForStudentFilter(officialSections, students)),
    [officialSections, students]
  );

  const loadData = useCallback(async () => {
    try {
      const { data: teacherSubjects } = await supabase
        .from('subjects')
        .select('*, course:courses(*)')
        .eq('teacher_id', user?.id);

      setMySubjects(teacherSubjects || []);

      const subjectIds = (teacherSubjects || []).map((s: any) => s.id);

      if (subjectIds.length > 0) {
        const { data: studentSubjects } = await supabase
          .from('student_subjects')
          .select('*, student:students(*, course:courses(*), user:users(*))')
          .in('subject_id', subjectIds);

        const uniqueStudents = new Map();
        (studentSubjects || []).forEach((ss: any) => {
          if (!uniqueStudents.has(ss.student.id)) {
            uniqueStudents.set(ss.student.id, {
              ...ss.student,
              subjects: [],
            });
          }
          const student = uniqueStudents.get(ss.student.id);
          const subject = teacherSubjects?.find((s: any) => s.id === ss.subject_id);
          if (subject && !student.subjects.find((sub: any) => sub.id === subject.id)) {
            student.subjects.push(subject);
          }
        });

        const studentList = Array.from(uniqueStudents.values()) as any[];
        setStudents(studentList);

        const studentIds = studentList.map((s) => s.id);
        if (studentIds.length > 0) {
          const { data: gradesData } = await supabase
            .from('grades')
            .select('*')
            .in('student_id', studentIds)
            .in('subject_id', subjectIds);
          setStudentGrades(gradesData || []);
        } else {
          setStudentGrades([]);
        }
      } else {
        setStudents([]);
        setStudentGrades([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useSupabaseLiveReload(loadData, user?.id ? `live:teacher-students:${user.id}` : null, [
    'grades',
    'student_subjects',
    'subjects',
    'students',
    'courses',
  ]);

  const courseOptions = useMemo(() => {
    const m = new Map<string, string>();
    students.forEach((s: any) => {
      if (s.course_id && s.course?.name) m.set(s.course_id, s.course.name);
    });
    return sortByLabel(Array.from(m.entries()).map(([value, label]) => ({ value, label })));
  }, [students]);

  const filteredStudents = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    const filtered = students.filter((s: any) => {
      const name = formatPersonDisplayName(s).toLowerCase();
      if (q && !name.includes(q)) return false;
      if (filterCourseId && s.course_id !== filterCourseId) return false;
      if (filterYear && (s.grade_level || '') !== filterYear) return false;
      if (!matchesOfficialSectionFilter(s.section_id, filterSection)) return false;
      if (filterSubjectId && !s.subjects?.some((sub: any) => sub.id === filterSubjectId)) return false;
      return true;
    });
    return sortByStudentName(filtered);
  }, [students, filterSearch, filterCourseId, filterYear, filterSection, filterSubjectId]);

  const hasActiveFilters =
    Boolean(filterSearch.trim()) ||
    Boolean(filterCourseId) ||
    Boolean(filterYear) ||
    Boolean(filterSection) ||
    Boolean(filterSubjectId);

  const clearFilters = () => {
    setFilterSearch('');
    setFilterCourseId('');
    setFilterYear('');
    setFilterSection('');
    setFilterSubjectId('');
  };

  const quarterLabel = (q: number) => ['', 'Prelim', 'Midterm', 'Pre-Finals', 'Finals'][q] || `Q${q}`;

  const getStudentSubjectGradeCards = (student: any) => {
    return (student.subjects || []).map((subject: any) => {
      const rows = studentGrades
        .filter((g) => g.student_id === student.id && g.subject_id === subject.id)
        .sort((a, b) => compareNumeric(a.semester, b.semester) || compareNumeric(a.quarter, b.quarter));
      const numeric = rows.filter((g) => g.grade_status !== 'inc').map((g) => Number(g.grade));
      const hasInc = rows.some((g) => g.grade_status === 'inc');
      const avg = numeric.length ? Math.round((numeric.reduce((s, n) => s + n, 0) / numeric.length) * 100) / 100 : null;
      const status = hasInc ? 'inc' : getGradeStatus(avg ?? 0);
      const isBackSubject =
        yearLevelRank(subject?.year_level) > 0 &&
        yearLevelRank(student?.grade_level) > 0 &&
        yearLevelRank(subject?.year_level) < yearLevelRank(student?.grade_level);
      return { subject, rows, avg, status, isBackSubject };
    });
  };

  if (loading) {
    return <DashboardLayout title="Students"><PageSkeletonLoader rows={5} /></DashboardLayout>;
  }

  return (
    <DashboardLayout title="My Students">

      <div className="mb-5 w-full max-w-2xl">
        <label htmlFor="teacher-student-search" className="sr-only">
          Search students
        </label>
        <div className="relative">
          <span
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-maroon-700/75"
            aria-hidden
          >
            <Search className="h-5 w-5 shrink-0" strokeWidth={2} />
          </span>
          <input
            id="teacher-student-search"
            type="search"
            autoComplete="off"
            placeholder="Search by student name…"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="w-full rounded-2xl border border-white/70 bg-white/55 py-3.5 pl-12 pr-4 text-base text-gray-900 shadow-[0_8px_32px_rgba(128,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl placeholder:text-gray-500 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/35"
          />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-maroon-200 bg-white text-[#800000] shadow-sm transition-colors hover:bg-maroon-50 touch-manipulation"
          aria-expanded={filtersOpen}
          aria-label={filtersOpen ? 'Hide student filters' : 'Show student filters'}
          title="Filters"
        >
          <ListFilter className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          {hasActiveFilters && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#d4af37] ring-2 ring-white" aria-hidden />
          )}
        </button>
        {!filtersOpen && (
          <span className="text-sm text-gray-600">
            Showing <span className="font-semibold text-[#800000]">{filteredStudents.length}</span>
            {' / '}
            {students.length} student{students.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {filtersOpen && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 animate-fade-in">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-[#800000]">Filter students</h2>
            {hasActiveFilters && (
              <Button type="button" variant="secondary" className="w-full shrink-0 sm:w-auto" onClick={clearFilters}>
                <RefreshCw className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                Clear filters
              </Button>
            )}
          </div>
          <p className="mb-4 text-sm leading-relaxed text-gray-600">
            Use the search bar above for names. Narrow the table by program, year level, section, or one of your subjects.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              label="Course / program"
              value={filterCourseId}
              onChange={(e) => setFilterCourseId(e.target.value)}
              options={sortSelectOptions([{ value: '', label: 'All courses' }, ...courseOptions], [''])}
            />
            <Select
              label="Year level"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              options={[
                { value: '', label: 'All years' },
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
            <Select
              label="Enrolled in subject"
              value={filterSubjectId}
              onChange={(e) => setFilterSubjectId(e.target.value)}
              options={sortSelectOptions(
                [{ value: '', label: 'Any of your subjects' }, ...sortByName(mySubjects).map((s) => ({ value: s.id, label: s.name || '' }))],
                ['']
              )}
            />
          </div>
          <p className="mt-4 text-sm text-gray-600">
            Showing <span className="font-semibold text-[#800000]">{filteredStudents.length}</span> of {students.length}{' '}
            student{students.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#800000] to-[#a52a2a] flex items-center justify-center text-white">
              <UserRound className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#800000]">{students.length}</p>
              <p className="text-sm text-gray-500">Total Students</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#b8962e] flex items-center justify-center text-maroon-900">
              <GraduationCap className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#d4af37]">{mySubjects.length}</p>
              <p className="text-sm text-gray-500">My Subjects</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
              <BookUser className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {new Set(students.map((s: any) => s.course_id).filter(Boolean)).size}
              </p>
              <p className="text-sm text-gray-500">Courses</p>
            </div>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-[#800000] mb-4">Enrolled students</h2>
        {students.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No students enrolled in your subjects yet</p>
        ) : filteredStudents.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No students match your filters. Adjust or clear filters.</p>
        ) : (
          <Table headers={['Name', 'Course', 'Year', 'Section', 'Enrolled subjects']}>
            {filteredStudents.map((student: any) => (
              <tr key={student.id} className="hover:bg-white/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#800000] to-[#d4af37] flex items-center justify-center text-white text-sm font-bold">
                      {student.first_name?.[0] || 'S'}
                    </div>
                    <span className="font-medium text-gray-800">
                      {formatPersonDisplayName(student)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{student.course?.name || '-'}</td>
                <td className="px-4 py-3 text-gray-600">{student.grade_level || '-'}</td>
                <td className="px-4 py-3 text-gray-600">{officialSectionDisplayName(student, sectionsById)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {student.subjects?.slice(0, 3).map((sub: any) => (
                      <Badge key={sub.id} variant="info">
                        {sub.name}
                      </Badge>
                    ))}
                    {student.subjects?.length > 3 && (
                      <Badge variant="warning">+{student.subjects.length - 3} more</Badge>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </GlassCard>

      <div className="mt-8">
        <h2 className="mb-4 text-xl font-semibold text-[#800000]">Student grade cards</h2>
        {filteredStudents.length === 0 ? (
          <GlassCard className="p-6">
            <p className="text-center text-gray-500">No students match your current filters.</p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredStudents.map((student: any) => {
              const subjectCards = getStudentSubjectGradeCards(student);
              return (
                <GlassCard key={`card-${student.id}`} className="p-4 sm:p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-gray-800">{formatPersonDisplayName(student)}</p>
                      <p className="text-xs text-gray-500">
                        {student.course?.name || '-'} · {student.grade_level || '-'} · {officialSectionDisplayName(student, sectionsById)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {subjectCards.some((c) => c.isBackSubject) && <Badge variant="warning">Has Back Subject</Badge>}
                      <Badge variant="info">{subjectCards.length} subject{subjectCards.length !== 1 ? 's' : ''}</Badge>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {subjectCards.length === 0 ? (
                      <p className="text-sm text-gray-500">No grades yet for this student.</p>
                    ) : subjectCards.map(({ subject, rows, avg, status, isBackSubject }) => (
                      <div key={`${student.id}-${subject.id}`} className="rounded-xl border border-gray-200 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[#800000]">{subject.name}</p>
                          <div className="flex items-center gap-1.5">
                            {isBackSubject && <Badge variant="warning">Back Subject</Badge>}
                            <Badge variant={status === 'inc' ? 'warning' : status === 'passed' ? 'success' : 'danger'}>
                              {status.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {rows.length === 0 ? (
                            <span className="text-xs text-gray-500">No quarter grades yet.</span>
                          ) : rows.map((g: any) => (
                            <span key={g.id} className="rounded-md border border-gray-300 bg-white/95 px-2 py-1 text-xs font-medium text-gray-900 shadow-sm">
                              S{g.semester} {quarterLabel(g.quarter)}: {g.grade_status === 'inc' ? 'INC' : g.grade}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-gray-600">
                          Final average: <span className="font-semibold text-gray-800">{status === 'inc' ? 'INC' : avg ?? '—'}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
