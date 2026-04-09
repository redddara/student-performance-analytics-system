import { useEffect, useMemo, useState } from 'react';
import { ListFilter, RefreshCw } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Button, Input, Select, Spinner } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase } from '../../lib/supabase';

export default function TeacherSubjectsPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);

  const [filterSearch, setFilterSearch] = useState('');
  const [filterCourseId, setFilterCourseId] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    void loadData();
  }, [user?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('subjects')
        .select('*, course:courses(*), teacher:users(*)')
        .eq('teacher_id', user?.id)
        .order('name');
      setMySubjects(data || []);
      const { data: coursesData } = await supabase.from('courses').select('id, name').order('name');
      setCourses(coursesData || []);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubjects = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return mySubjects.filter((s) => {
      if (q && !String(s.name || '').toLowerCase().includes(q)) return false;
      if (filterCourseId && s.course_id !== filterCourseId) return false;
      if (filterYear && (s.year_level || '') !== filterYear) return false;
      if (filterSemester && (s.semester || '') !== filterSemester) return false;
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

  const courseOptions = courses.map((c) => ({ value: c.id, label: c.name }));

  if (loading) {
    return <DashboardLayout title="My Subjects"><Spinner size="lg" /></DashboardLayout>;
  }

  return (
    <DashboardLayout title="My Subjects">
      

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
          {filteredSubjects.map((subject) => (
            <div key={subject.id} className="rounded-2xl border border-maroon-200/50 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="text-lg font-semibold text-[#800000]">{subject.name}</h3>
              <div className="mt-3 space-y-1 text-sm text-gray-700">
                <p><span className="font-semibold">Course:</span> {subject.course?.name || '-'}</p>
                <p><span className="font-semibold">Year level:</span> {subject.year_level || '-'}</p>
                <p><span className="font-semibold">Semester:</span> {subject.semester || '-'}</p>
                <p><span className="font-semibold">Teacher:</span> {(subject.teacher?.first_name || '') + ' ' + (subject.teacher?.last_name || '') || '-'}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
