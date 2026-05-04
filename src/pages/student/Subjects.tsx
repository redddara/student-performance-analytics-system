import { useState, useEffect, useMemo } from 'react';
import { ListFilter, RefreshCw, Search } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Spinner, Select, Button, Input } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase } from '../../lib/supabase';

export default function StudentSubjectsPage() {
  const { user } = useAuthStore();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterCourseId, setFilterCourseId] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: studentData } = await supabase.from('students').select('*').eq('user_id', user?.id).single();

      if (!studentData) return;

      const { data: studentSubjects } = await supabase
        .from('student_subjects')
        .select('*, subject:subjects(*, course:courses(*), teacher:users(*))')
        .eq('student_id', studentData.id);

      setMySubjects(studentSubjects || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubjects = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return mySubjects.filter((ss) => {
      const sub = ss.subject;
      const name = String(sub?.name || '').toLowerCase();
      const course = String(sub?.course?.name || '').toLowerCase();
      const teacher = String(
        sub?.teacher?.name || `${sub?.teacher?.first_name || ''} ${sub?.teacher?.last_name || ''}`
      )
        .trim()
        .toLowerCase();
      if (q && !name.includes(q) && !course.includes(q) && !teacher.includes(q)) return false;
      if (filterCourseId && sub?.course?.id !== filterCourseId) return false;
      if (filterYear && (sub?.year_level || '') !== filterYear) return false;
      if (filterSemester && (sub?.semester || '') !== filterSemester) return false;
      return true;
    });
  }, [mySubjects, filterSearch, filterCourseId, filterYear, filterSemester]);

  const hasActiveFilters =
    Boolean(filterSearch.trim()) || Boolean(filterCourseId) || Boolean(filterYear) || Boolean(filterSemester);

  const clearFilters = () => {
    setFilterSearch('');
    setFilterCourseId('');
    setFilterYear('');
    setFilterSemester('');
  };

  const courseOptions = Array.from(
    new Map(mySubjects.map((ss) => [ss.subject?.course?.id, ss.subject?.course?.name]).entries())
  )
    .filter(([id, name]) => Boolean(id && name))
    .map(([value, label]) => ({ value: String(value), label: String(label) }));

  if (loading) {
    return <DashboardLayout title="My Subjects"><Spinner size="lg" /></DashboardLayout>;
  }

  return (
    <DashboardLayout title="My Subjects">
      

      <div className="mb-5 w-full max-w-2xl">
        <label htmlFor="student-subject-search" className="sr-only">
          Search subjects
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-maroon-700/75" aria-hidden>
            <Search className="h-5 w-5 shrink-0" strokeWidth={2} />
          </span>
          <input
            id="student-subject-search"
            type="search"
            autoComplete="off"
            placeholder="Search subject, course, or teacher…"
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
          aria-label={filtersOpen ? 'Hide subject filters' : 'Show subject filters'}
          title="Filters"
        >
          <ListFilter className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          {hasActiveFilters && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#d4af37] ring-2 ring-white" aria-hidden />
          )}
        </button>
        {!filtersOpen && (
          <span className="text-sm text-gray-600">
            Showing <span className="font-semibold text-[#800000]">{filteredSubjects.length}</span> / {mySubjects.length}{' '}
            subject{mySubjects.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {filtersOpen && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 animate-fade-in">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-[#800000]">Filter subjects</h2>
            {hasActiveFilters && (
              <Button type="button" variant="secondary" className="w-full shrink-0 sm:w-auto" onClick={clearFilters}>
                <RefreshCw className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                Clear filters
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Search by subject name"
              placeholder="Type to filter..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
            />
            <Select
              label="Course"
              value={filterCourseId}
              onChange={(e) => setFilterCourseId(e.target.value)}
              options={[{ value: '', label: 'All courses' }, ...courseOptions]}
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
              label="Semester"
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              options={[
                { value: '', label: 'All semesters' },
                { value: '1st Sem', label: '1st Sem' },
                { value: '2nd Sem', label: '2nd Sem' },
              ]}
            />
          </div>
        </div>
      )}

      {filteredSubjects.length === 0 ? (
        <GlassCard className="p-5 sm:p-6">
          <p className="text-center text-gray-100">
            {mySubjects.length === 0
              ? 'No subjects are assigned to your account yet.'
              : 'No subjects match your filters.'}
          </p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {filteredSubjects.map((ss) => (
            <div key={ss.id} className="rounded-2xl border border-maroon-200/50 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="text-lg font-semibold text-[#800000]">{ss.subject?.name}</h3>
              <div className="mt-3 space-y-1 text-sm text-gray-700">
                <p><span className="font-semibold">Course:</span> {ss.subject?.course?.name || '-'}</p>
                <p><span className="font-semibold">Year level:</span> {ss.subject?.year_level || '-'}</p>
                <p><span className="font-semibold">Semester:</span> {ss.subject?.semester || '-'}</p>
                <p>
                  <span className="font-semibold">Teacher:</span>{' '}
                  {ss.subject?.teacher
                    ? (ss.subject.teacher.name || `${ss.subject.teacher.first_name || ''} ${ss.subject.teacher.last_name || ''}`.trim())
                    : '-'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
