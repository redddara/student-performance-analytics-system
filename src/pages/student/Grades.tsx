import { useState, useEffect, useMemo, useCallback } from 'react';
import { useGradesAutoRefresh } from '../../lib/useGradesAutoRefresh';
import { ListFilter, RefreshCw, Search } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Select, Table, Button, PageSkeletonLoader } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, calculateGWA } from '../../lib/supabase';

/** Grades with no school_year_id (legacy rows) */
const LEGACY_SCHOOL_YEAR_SCOPE = '__legacy__';

type GradeRow = {
  subject_id?: string;
  semester?: number;
  quarter?: number;
  school_year_id?: string | null;
  subject?: { name?: string; semester?: string; course?: { name?: string } };
  school_year?: { id?: string; name?: string };
  grade_status?: string;
  grade?: number;
  is_locked?: boolean;
  workflow_status?: string;
};

export default function StudentGradesPage() {
  const { user } = useAuthStore();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [myGrades, setMyGrades] = useState<GradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolYears, setSchoolYears] = useState<any[]>([]);
  const [activeSchoolYearId, setActiveSchoolYearId] = useState<string | null>(null);
  const [schoolYearFilter, setSchoolYearFilter] = useState<'active' | 'all' | string>('active');
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [selectedQuarter, setSelectedQuarter] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterYearLevel, setFilterYearLevel] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeSchoolYearName, setActiveSchoolYearName] = useState('All years');
  /** '' = all years (grouped tables); otherwise one school_years.id */
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState('');

  const loadData = useCallback(async () => {
    try {
      const { data: studentData } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (!studentData) return;

      let effectiveSchoolYearId: string | null = null;
      try {
        const syRes = await supabase
          .from('school_years')
          .select('id,name,is_active,created_at')
          .order('created_at', { ascending: false });
        if (syRes.error) throw syRes.error;
        const list = syRes.data || [];
        setSchoolYears(list);
        const active = list.find((sy: any) => Boolean(sy.is_active)) || null;
        setActiveSchoolYearId(active?.id ?? null);
        setActiveSchoolYearName(active?.name || 'All years');
        effectiveSchoolYearId =
          schoolYearFilter === 'all'
            ? null
            : schoolYearFilter === 'active'
              ? (active?.id ?? null)
              : (schoolYearFilter || null);
      } catch {
        // Backward-compat: if school_years isn't available, show all years.
        setSchoolYears([]);
        setActiveSchoolYearId(null);
        setActiveSchoolYearName('All years');
        effectiveSchoolYearId = null;
      }

      const [subjectsRes, gradesRes] = await Promise.all([
        supabase.from('student_subjects').select('*, subject:subjects(*, course:courses(*))').eq('student_id', studentData.id),
        (async () => {
          let q = supabase
            .from('grades')
            .select('*, subject:subjects(*, course:courses(*)), school_year:school_years(id,name)')
            .eq('student_id', studentData.id);
          if (effectiveSchoolYearId) q = q.eq('school_year_id', effectiveSchoolYearId);
          return q;
        })(),
      ]);

      setMySubjects(subjectsRes.data || []);
      setMyGrades((gradesRes.data as GradeRow[]) || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, schoolYearFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useGradesAutoRefresh(loadData, user?.id ? `grades-live:student-grades:${user.id}` : null);

  const schoolYearOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const g of myGrades) {
      const id = g.school_year_id;
      if (!id) continue;
      const name = g.school_year?.name || 'School year';
      byId.set(id, name);
    }
    if (activeSchoolYearId && activeSchoolYearName && activeSchoolYearName !== 'All years') {
      if (!byId.has(activeSchoolYearId)) {
        byId.set(activeSchoolYearId, activeSchoolYearName);
      }
    }
    const rows = [...byId.entries()]
      .map(([id, name]) => ({ id, name: name && name.trim() ? name : `Unknown school year (${id.slice(0, 8)}...)` }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return [{ value: '', label: 'All school years' }, ...rows.map((r) => ({ value: r.id, label: r.name }))];
  }, [myGrades, activeSchoolYearId, activeSchoolYearName]);

  const yearIdsForGrouping = useMemo(() => {
    const ids = [
      ...new Set(
        myGrades
          .filter((g) => g.semester === selectedSemester)
          .map((g) => g.school_year_id)
          .filter(Boolean)
      ),
    ] as string[];
    const nameFor = (id: string) => myGrades.find((g) => g.school_year_id === id)?.school_year?.name || id;
    return ids.sort((a, b) => nameFor(b).localeCompare(nameFor(a)));
  }, [myGrades, selectedSemester]);

  const semesterLabel = selectedSemester === 1 ? '1st Sem' : '2nd Sem';

  const yearScopesForGrouping = useMemo(() => {
    const scopes: { key: string; label: string }[] = [];
    if (myGrades.some((g) => !g.school_year_id && g.semester === selectedSemester)) {
      scopes.push({ key: LEGACY_SCHOOL_YEAR_SCOPE, label: 'Unassigned school year' });
    }
    for (const id of yearIdsForGrouping) {
      const label = myGrades.find((g) => g.school_year_id === id)?.school_year?.name || 'School year';
      scopes.push({ key: id, label });
    }
    return scopes;
  }, [myGrades, yearIdsForGrouping, selectedSemester]);

  const buildSubjectRows = useCallback(
    (scopeKey: string) => {
      const gradeInScope = myGrades.filter((g) => {
        const yMatch =
          scopeKey === LEGACY_SCHOOL_YEAR_SCOPE ? !g.school_year_id : g.school_year_id === scopeKey;
        if (!yMatch) return false;
        return g.semester === selectedSemester;
      });
      const map = new Map<string, { subject_id: string; subject: any }>();
      for (const g of gradeInScope) {
        if (g.subject_id && g.subject && !map.has(g.subject_id)) {
          map.set(g.subject_id, { subject_id: g.subject_id, subject: g.subject });
        }
      }
      const scopeIsActiveYear =
        Boolean(activeSchoolYearId && scopeKey === activeSchoolYearId && scopeKey !== LEGACY_SCHOOL_YEAR_SCOPE);
      if (scopeIsActiveYear) {
        for (const ss of mySubjects) {
          if (ss.subject?.semester === semesterLabel && ss.subject_id && !map.has(ss.subject_id)) {
            map.set(ss.subject_id, { subject_id: ss.subject_id, subject: ss.subject });
          }
        }
      }
      return [...map.values()];
    },
    [myGrades, mySubjects, selectedSemester, semesterLabel, activeSchoolYearId]
  );

  const getFilteredGrades = (scopeKey: string) => {
    return myGrades.filter((g) => {
      const yMatch =
        scopeKey === LEGACY_SCHOOL_YEAR_SCOPE ? !g.school_year_id : g.school_year_id === scopeKey;
      if (!yMatch) return false;
      return (
        g.semester === selectedSemester &&
        (!selectedQuarter || g.quarter?.toString() === selectedQuarter)
      );
    });
  };

  const getSubjectGrade = (subjectId: string, quarter: number, scopeKey: string) => {
    const grade = getFilteredGrades(scopeKey).find(
      (g) => g.subject_id === subjectId.toString() && g.quarter === quarter
    );
    if (!grade) return '-';
    const base = grade.grade_status === 'inc' ? 'INC' : grade.grade?.toString() || '-';
    if (grade.is_locked) return `${base} (L)`;
    if (grade.workflow_status === 'for_review') return `${base} (R)`;
    return base;
  };

  const getSubjectAverage = (subjectId: string, scopeKey: string) => {
    const subjectGrades = getFilteredGrades(scopeKey).filter(
      (g) => g.subject_id === subjectId && g.grade_status !== 'inc'
    );
    if (subjectGrades.length === 0) return '-';
    const avg = calculateGWA(subjectGrades as any[]);
    return avg.toFixed(2).toString();
  };

  const calculateSemesterGWA = (scopeKey: string) => {
    const semesterGrades = getFilteredGrades(scopeKey);
    if (semesterGrades.length === 0) return '-';
    return calculateGWA(semesterGrades as any[]).toFixed(2);
  };

  const subjectMatchesSearchAndYear = useCallback(
    (ss: { subject?: { name?: string; course?: { name?: string }; year_level?: string } }) => {
      const q = filterSearch.trim().toLowerCase();
      const name = String(ss.subject?.name || '').toLowerCase();
      const course = String(ss.subject?.course?.name || '').toLowerCase();
      if (q && !name.includes(q) && !course.includes(q)) return false;
      if (filterYearLevel && (ss.subject?.year_level || '') !== filterYearLevel) return false;
      return true;
    },
    [filterSearch, filterYearLevel]
  );

  const semesterSubjects = useMemo(
    () => (selectedSchoolYearId ? buildSubjectRows(selectedSchoolYearId) : []),
    [selectedSchoolYearId, buildSubjectRows]
  );

  const filteredSemesterSubjects = useMemo(() => {
    return semesterSubjects.filter(subjectMatchesSearchAndYear);
  }, [semesterSubjects, subjectMatchesSearchAndYear]);

  const groupedGradePanels = useMemo(() => {
    if (selectedSchoolYearId) return null;
    return yearScopesForGrouping.map(({ key, label }) => {
      const rows = buildSubjectRows(key);
      const filtered = rows.filter(subjectMatchesSearchAndYear);
      return { scopeKey: key, title: label, rows, filtered };
    });
  }, [selectedSchoolYearId, yearScopesForGrouping, buildSubjectRows, subjectMatchesSearchAndYear]);

  const subjectCountSummary = useMemo(() => {
    if (selectedSchoolYearId) {
      return { shown: filteredSemesterSubjects.length, total: semesterSubjects.length, grouped: false };
    }
    const panels = groupedGradePanels || [];
    const total = panels.reduce((a, p) => a + p.rows.length, 0);
    const shown = panels.reduce((a, p) => a + p.filtered.length, 0);
    return { shown, total, grouped: true };
  }, [selectedSchoolYearId, filteredSemesterSubjects, semesterSubjects, groupedGradePanels]);

  const hasActiveFilters =
    Boolean(filterSearch.trim()) ||
    Boolean(filterYearLevel) ||
    selectedSemester !== 1 ||
    selectedQuarter !== '' ||
    schoolYearFilter !== 'active' ||
    (activeSchoolYearId ? selectedSchoolYearId !== activeSchoolYearId : selectedSchoolYearId !== '');

  const clearFilters = () => {
    setFilterSearch('');
    setFilterYearLevel('');
    setSelectedSemester(1);
    setSelectedQuarter('');
    setSchoolYearFilter('active');
    setSelectedSchoolYearId(activeSchoolYearId || '');
  };

  const displaySchoolYearLabel =
    selectedSchoolYearId === ''
      ? 'All school years'
      : schoolYearOptions.find((o) => o.value === selectedSchoolYearId)?.label ||
        activeSchoolYearName;

  if (loading) {
    return <DashboardLayout title="My Grades"><PageSkeletonLoader rows={4} /></DashboardLayout>;
  }

  return (
    <DashboardLayout title="My Grades">
      

      <div className="mb-5 w-full max-w-2xl">
        <label htmlFor="student-grade-subject-search" className="sr-only">
          Search subjects
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-maroon-700/75" aria-hidden>
            <Search className="h-5 w-5 shrink-0" strokeWidth={2} />
          </span>
          <input
            id="student-grade-subject-search"
            type="search"
            autoComplete="off"
            placeholder="Search subject or course…"
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
          aria-label={filtersOpen ? 'Hide grade filters' : 'Show grade filters'}
          title="Filters"
        >
          <ListFilter className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          {hasActiveFilters && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#d4af37] ring-2 ring-white" aria-hidden />
          )}
        </button>
        {!filtersOpen && (
          <span className="text-sm text-gray-600">
            Showing <span className="font-semibold text-[#800000]">{subjectCountSummary.shown}</span> /{' '}
            {subjectCountSummary.total} subject{subjectCountSummary.total !== 1 ? 's' : ''}
            {subjectCountSummary.grouped ? ' across school years' : ' this semester'}
          </span>
        )}
      </div>

      {filtersOpen && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 animate-fade-in">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-[#800000]">Filter grades</h2>
            {hasActiveFilters && (
              <Button type="button" variant="secondary" className="w-full shrink-0 sm:w-auto" onClick={clearFilters}>
                <RefreshCw className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                Clear filters
              </Button>
            )}
          </div>
          <p className="mb-4 text-sm leading-relaxed text-gray-600">
            Use the search bar above to filter subjects by name or course. Adjust semester and quarter here.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              label="School year"
              value={schoolYearFilter}
              onChange={(e) => setSchoolYearFilter(e.target.value as any)}
              options={[
                { value: 'active', label: activeSchoolYearId ? 'Active school year' : 'Active school year (none)' },
                { value: 'all', label: 'All school years' },
                ...(schoolYears || []).map((sy: any) => ({ value: sy.id, label: sy.name })),
              ]}
            />
            <Select
              label="Semester"
              value={`${selectedSemester}`}
              onChange={(e) => setSelectedSemester(parseInt(e.target.value, 10))}
              options={[{ value: '1', label: '1st Semester' }, { value: '2', label: '2nd Semester' }]}
            />
            <Select
              label="Quarter"
              value={selectedQuarter}
              onChange={(e) => setSelectedQuarter(e.target.value)}
              options={[
                { value: '', label: 'All Quarters' },
                { value: '1', label: 'Prelim' },
                { value: '2', label: 'Midterm' },
                { value: '3', label: 'Pre-Finals' },
                { value: '4', label: 'Finals' },
              ]}
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
          </div>
          <p className="mt-4 text-sm text-gray-600">
            Showing <span className="font-semibold text-[#800000]">{subjectCountSummary.shown}</span> /{' '}
            {subjectCountSummary.total} subject{subjectCountSummary.total !== 1 ? 's' : ''}
            {subjectCountSummary.grouped ? ' across school years' : ' this semester'}
          </p>
        </div>
      )}

      <div className="mb-5 w-full max-w-md">
        <Select
          label="School year"
          value={selectedSchoolYearId}
          onChange={(e) => setSelectedSchoolYearId(e.target.value)}
          options={schoolYearOptions}
        />
      </div>

      <GlassCard className="p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-[#800000] mb-4">
          {selectedSemester === 1 ? '1st' : '2nd'} Semester Grades
        </h2>
        <p className="mb-3 text-sm text-gray-600">
          School Year: <span className="font-semibold text-[#800000]">{displaySchoolYearLabel}</span>
        </p>

        {selectedSchoolYearId ? (
          <>
            {filteredSemesterSubjects.length > 0 && (
              <Table headers={['Subject', 'Prelim', 'Midterm', 'Pre-Finals', 'Finals', 'Average']}>
                {filteredSemesterSubjects.map((ss) => (
                  <tr key={ss.subject_id} className="hover:bg-white/20">
                    <td className="px-4 py-3 font-medium text-gray-800">{ss.subject?.name}</td>
                    <td className="px-4 py-3 text-gray-600">{getSubjectGrade(ss.subject_id, 1, selectedSchoolYearId)}</td>
                    <td className="px-4 py-3 text-gray-600">{getSubjectGrade(ss.subject_id, 2, selectedSchoolYearId)}</td>
                    <td className="px-4 py-3 text-gray-600">{getSubjectGrade(ss.subject_id, 3, selectedSchoolYearId)}</td>
                    <td className="px-4 py-3 text-gray-600">{getSubjectGrade(ss.subject_id, 4, selectedSchoolYearId)}</td>
                    <td className="px-4 py-3 font-semibold text-[#800000]">
                      {getSubjectAverage(ss.subject_id, selectedSchoolYearId)}
                    </td>
                  </tr>
                ))}
              </Table>
            )}

            {semesterSubjects.length === 0 && (
              <p className="text-center text-gray-500 py-8">No subjects for this semester</p>
            )}

            {semesterSubjects.length > 0 && filteredSemesterSubjects.length === 0 && (
              <p className="text-center text-gray-500 py-8">No subjects match your search.</p>
            )}

            {semesterSubjects.length > 0 && (
              <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-[#800000] to-[#d4af37] text-white">
                <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center">
                  <span className="font-semibold">Semester GWA:</span>
                  <span className="text-2xl font-bold">{calculateSemesterGWA(selectedSchoolYearId)}</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {(groupedGradePanels || []).map((panel) => (
              <div key={panel.scopeKey} className="mb-8 last:mb-0">
                <h3 className="text-lg font-medium text-[#800000] mb-3">{panel.title}</h3>
                {panel.filtered.length > 0 ? (
                  <Table headers={['Subject', 'Prelim', 'Midterm', 'Pre-Finals', 'Finals', 'Average']}>
                    {panel.filtered.map((ss) => (
                      <tr key={`${panel.scopeKey}-${ss.subject_id}`} className="hover:bg-white/20">
                        <td className="px-4 py-3 font-medium text-gray-800">{ss.subject?.name}</td>
                        <td className="px-4 py-3 text-gray-600">{getSubjectGrade(ss.subject_id, 1, panel.scopeKey)}</td>
                        <td className="px-4 py-3 text-gray-600">{getSubjectGrade(ss.subject_id, 2, panel.scopeKey)}</td>
                        <td className="px-4 py-3 text-gray-600">{getSubjectGrade(ss.subject_id, 3, panel.scopeKey)}</td>
                        <td className="px-4 py-3 text-gray-600">{getSubjectGrade(ss.subject_id, 4, panel.scopeKey)}</td>
                        <td className="px-4 py-3 font-semibold text-[#800000]">
                          {getSubjectAverage(ss.subject_id, panel.scopeKey)}
                        </td>
                      </tr>
                    ))}
                  </Table>
                ) : panel.rows.length === 0 ? (
                  <p className="text-sm text-gray-500 py-2">No grades for this semester in this school year.</p>
                ) : (
                  <p className="text-sm text-gray-500 py-2">No subjects match your search.</p>
                )}

                {panel.filtered.length > 0 && (
                  <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-[#800000] to-[#d4af37] text-white">
                    <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center">
                      <span className="font-semibold">Semester GWA ({panel.title}):</span>
                      <span className="text-2xl font-bold">{calculateSemesterGWA(panel.scopeKey)}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {yearScopesForGrouping.length === 0 && (
              <p className="text-center text-gray-500 py-8">No grades recorded for this semester yet.</p>
            )}
          </>
        )}

        <p className="mt-3 text-xs text-gray-500">Legend: `(L)` locked by admin, `(R)` for admin review.</p>
      </GlassCard>
    </DashboardLayout>
  );
}