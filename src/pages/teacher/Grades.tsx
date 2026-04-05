import { useState, useEffect, useMemo } from 'react';
import { ListFilter, RefreshCw, Search } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageIntro } from '../../components/layouts/PageIntro';
import { GlassCard, Select, Table, Spinner, Badge, Button } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, isPassing } from '../../lib/supabase';
import { SCHOOL_SECTION_SELECT_OPTIONS, normalizeSchoolSection } from '../../constants/schoolSections';

export default function TeacherGradesPage() {
  const { user } = useAuthStore();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [selectedQuarter, setSelectedQuarter] = useState('');

  const [filterSearch, setFilterSearch] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [subjectsRes, gradesRes, studentsRes] = await Promise.all([
      supabase.from('subjects').select('*, course:courses(*)').eq('teacher_id', user?.id),
      supabase.from('grades').select('*'),
      supabase.from('students').select('*, user:users(*)'),
    ]);
    setMySubjects(subjectsRes.data || []);
    setGrades(gradesRes.data || []);
    setStudents(studentsRes.data || []);
    if (subjectsRes.data?.length) setSelectedSubject(subjectsRes.data[0].id);
    setLoading(false);
  };

  const baseGrades = useMemo(() => {
    if (!selectedSubject) return [];
    return grades.filter(
      (g) =>
        g.subject_id === selectedSubject &&
        g.semester === selectedSemester &&
        (!selectedQuarter || g.quarter.toString() === selectedQuarter)
    );
  }, [grades, selectedSubject, selectedSemester, selectedQuarter]);

  const filteredGrades = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return baseGrades.filter((g) => {
      const st = students.find((s) => s.id === g.student_id);
      const name = `${st?.first_name || ''} ${st?.last_name || ''}`.trim().toLowerCase();
      if (q && !name.includes(q)) return false;
      if (filterSection && normalizeSchoolSection(st?.section) !== filterSection) return false;
      return true;
    });
  }, [baseGrades, filterSearch, filterSection, students]);

  const hasActiveFilters = Boolean(filterSearch.trim()) || Boolean(filterSection);

  const clearFilters = () => {
    setFilterSearch('');
    setFilterSection('');
  };

  const getStudentName = (id: string) => {
    const s = students.find((st) => st.id === id);
    return s ? `${s.first_name} ${s.last_name}` : 'Unknown';
  };

  const getSubjectName = (id: string) => {
    const s = mySubjects.find((sub) => sub.id === id);
    return s?.name || 'Unknown';
  };

  if (loading) {
    return <DashboardLayout title="Grades"><Spinner size="lg" /></DashboardLayout>;
  }

  return (
    <DashboardLayout title="Grade Management">
      <PageIntro
        title="Grade book"
        subtitle="Use filters for subject, term, and section. Search narrows the list below."
      />

      <div className="mb-4 text-sm text-gray-600">
        {selectedSubject ? (
          <>
            Viewing{' '}
            <span className="font-semibold text-[#800000]">
              {mySubjects.find((s) => s.id === selectedSubject)?.name || 'Subject'}
            </span>
            {' · '}
            {selectedSemester === 1 ? '1st' : '2nd'} semester
            {' · '}
            {selectedQuarter === ''
              ? 'All quarters'
              : ['', 'Prelim', 'Midterm', 'Pre-Finals', 'Finals'][Number(selectedQuarter)] || 'Quarter'}
          </>
        ) : (
          <span className="text-gray-500">Select a subject in filters to load grades.</span>
        )}
      </div>

      <div className="mb-5 w-full max-w-2xl">
        <label htmlFor="teacher-grade-search" className="sr-only">
          Search by student name
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-maroon-700/75" aria-hidden>
            <Search className="h-5 w-5 shrink-0" strokeWidth={2} />
          </span>
          <input
            id="teacher-grade-search"
            type="search"
            autoComplete="off"
            placeholder="Search student in this view…"
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
          aria-label={filtersOpen ? 'Hide filters' : 'Show filters'}
          title="Filters"
        >
          <ListFilter className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          {hasActiveFilters && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#d4af37] ring-2 ring-white" aria-hidden />
          )}
        </button>
        <span className="text-sm text-gray-600">
          Showing <span className="font-semibold text-[#800000]">{filteredGrades.length}</span> / {baseGrades.length}{' '}
          grade{baseGrades.length !== 1 ? 's' : ''}
        </span>
      </div>

      {filtersOpen && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 animate-fade-in">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-[#800000]">Filters</h2>
            {hasActiveFilters && (
              <Button type="button" variant="secondary" className="w-full shrink-0 sm:w-auto" onClick={clearFilters}>
                <RefreshCw className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                Clear search & section
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label="Subject"
              value={`${selectedSubject}`}
              onChange={(e) => setSelectedSubject(e.target.value)}
              options={
                mySubjects.length
                  ? mySubjects.map((s) => ({ value: `${s.id}`, label: `${s.name} — ${s.course?.name || ''}` }))
                  : [{ value: '', label: 'No subjects assigned' }]
              }
            />
            <Select
              label="Semester"
              value={`${selectedSemester}`}
              onChange={(e) => setSelectedSemester(parseInt(e.target.value, 10))}
              options={[
                { value: '1', label: '1st Semester' },
                { value: '2', label: '2nd Semester' },
              ]}
            />
            <Select
              label="Quarter"
              value={selectedQuarter}
              onChange={(e) => setSelectedQuarter(e.target.value)}
              options={[
                { value: '', label: 'All quarters' },
                { value: '1', label: 'Prelim' },
                { value: '2', label: 'Midterm' },
                { value: '3', label: 'Pre-Finals' },
                { value: '4', label: 'Finals' },
              ]}
            />
            <Select
              label="Student section"
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
              options={[{ value: '', label: 'All sections' }, ...SCHOOL_SECTION_SELECT_OPTIONS]}
            />
          </div>
        </div>
      )}

      <GlassCard className="p-4 sm:p-6">
        <Table headers={['Student', 'Subject', 'Semester', 'Quarter', 'Grade', 'Remarks', 'Status']}>
          {filteredGrades.map((grade) => (
            <tr key={grade.id} className="hover:bg-white/20">
              <td className="px-4 py-3 font-medium text-gray-800">{getStudentName(grade.student_id)}</td>
              <td className="px-4 py-3 text-gray-600">{getSubjectName(grade.subject_id)}</td>
              <td className="px-4 py-3 text-gray-600">{grade.semester === 1 ? '1st Sem' : '2nd Sem'}</td>
              <td className="px-4 py-3 text-gray-600">
                {['', 'Prelim', 'Midterm', 'Pre-Finals', 'Finals'][grade.quarter]}
              </td>
              <td className="px-4 py-3 font-medium text-gray-800">{grade.grade}</td>
              <td className="px-4 py-3 text-gray-600">{grade.remarks || '—'}</td>
              <td className="px-4 py-3">
                <Badge variant={isPassing(grade.grade) ? 'success' : 'danger'}>
                  {isPassing(grade.grade) ? 'Passing' : 'Failing'}
                </Badge>
              </td>
            </tr>
          ))}
        </Table>
        {baseGrades.length === 0 && (
          <p className="text-center text-gray-500 py-8">No grades match subject / semester / quarter.</p>
        )}
        {baseGrades.length > 0 && filteredGrades.length === 0 && (
          <p className="text-center text-gray-500 py-8">No rows match your search or section filter.</p>
        )}
      </GlassCard>
    </DashboardLayout>
  );
}
