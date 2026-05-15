import { useState, useEffect, useMemo, useCallback } from 'react';
import { useGradesAutoRefresh } from '../../lib/useGradesAutoRefresh';
import { ListFilter, RefreshCw, Search } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Select, Table, Button, PageSkeletonLoader } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, calculateGWA, formatGradeDisplay, toGradePoint } from '../../lib/supabase';
import { compareAlphabetical, sortByLabel } from '../../lib/sortUtils';
import {
  computeSubjectFinalGrade,
  getSubjectInsights,
  type GradeRecord,
} from '../../lib/studentGradeInsights';

/** Grades with no school_year_id (legacy rows) */
const LEGACY_SCHOOL_YEAR_SCOPE = '__legacy__';

const INSIGHT_HEADERS = ['Strength', 'Areas to Improve', 'Suggestion'] as const;

type GradeRow = GradeRecord & {
  subject_id?: string;
  subject?: { name?: string; code?: string; semester?: string; course?: { name?: string }; year_level?: string };
  school_year?: { id?: string; name?: string };
  is_locked?: boolean;
  workflow_status?: string;
};

type SubjectRow = { subject_id: string; subject: GradeRow['subject'] };

function scopeKeyFromGrade(g: GradeRow): string {
  return g.school_year_id ? g.school_year_id : LEGACY_SCHOOL_YEAR_SCOPE;
}

function InsightCellHover({ label, reason }: { label: string; reason: string }) {
  if (label === '—') {
    return <td className="px-4 py-3 text-gray-400">—</td>;
  }
  return (
    <td className="group relative px-4 py-3">
      <span className="cursor-help border-b border-dotted border-gray-400 text-sm text-gray-700">
        {label}
      </span>
      <div className="pointer-events-none absolute left-0 bottom-full z-30 mb-2 hidden w-64 rounded-lg border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-700 shadow-lg group-hover:block">
        {reason}
      </div>
    </td>
  );
}

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
      .sort((a, b) => compareAlphabetical(a.name, b.name));
    return [{ value: '', label: 'All school years' }, ...sortByLabel(rows.map((r) => ({ value: r.id, label: r.name })))];
  }, [myGrades, activeSchoolYearId, activeSchoolYearName]);

  const allYearScopes = useMemo(() => {
    const scopes: { key: string; label: string }[] = [];
    const seen = new Set<string>();
    if (myGrades.some((g) => !g.school_year_id)) {
      scopes.push({ key: LEGACY_SCHOOL_YEAR_SCOPE, label: 'Unassigned school year' });
      seen.add(LEGACY_SCHOOL_YEAR_SCOPE);
    }
    const yearIds = [
      ...new Set(myGrades.map((g) => g.school_year_id).filter(Boolean)),
    ] as string[];
    for (const id of yearIds.sort((a, b) => {
      const nameA = myGrades.find((g) => g.school_year_id === a)?.school_year?.name || a;
      const nameB = myGrades.find((g) => g.school_year_id === b)?.school_year?.name || b;
      return compareAlphabetical(nameA, nameB);
    })) {
      if (seen.has(id)) continue;
      seen.add(id);
      const label = myGrades.find((g) => g.school_year_id === id)?.school_year?.name || 'School year';
      scopes.push({ key: id, label });
    }
    return scopes;
  }, [myGrades]);

  const semesterLabelFor = (semester: number) => (semester === 1 ? '1st Sem' : '2nd Sem');

  const buildSubjectRows = useCallback(
    (scopeKey: string, semester: number) => {
      const gradeInScope = myGrades.filter((g) => {
        const yMatch =
          scopeKey === LEGACY_SCHOOL_YEAR_SCOPE ? !g.school_year_id : g.school_year_id === scopeKey;
        return yMatch && g.semester === semester;
      });
      const map = new Map<string, SubjectRow>();
      for (const g of gradeInScope) {
        if (g.subject_id && g.subject && !map.has(g.subject_id)) {
          map.set(g.subject_id, { subject_id: g.subject_id, subject: g.subject });
        }
      }
      const semLabel = semesterLabelFor(semester);
      const scopeIsActiveYear =
        Boolean(activeSchoolYearId && scopeKey === activeSchoolYearId && scopeKey !== LEGACY_SCHOOL_YEAR_SCOPE);
      if (scopeIsActiveYear) {
        for (const ss of mySubjects) {
          if (ss.subject?.semester === semLabel && ss.subject_id && !map.has(ss.subject_id)) {
            map.set(ss.subject_id, { subject_id: ss.subject_id, subject: ss.subject });
          }
        }
      }
      return [...map.values()];
    },
    [myGrades, mySubjects, activeSchoolYearId],
  );

  const getFilteredGrades = useCallback(
    (scopeKey: string, semester: number) => {
      return myGrades.filter((g) => {
        const yMatch =
          scopeKey === LEGACY_SCHOOL_YEAR_SCOPE ? !g.school_year_id : g.school_year_id === scopeKey;
        if (!yMatch) return false;
        return (
          g.semester === semester &&
          (!selectedQuarter || g.quarter?.toString() === selectedQuarter)
        );
      });
    },
    [myGrades, selectedQuarter],
  );

  const getSubjectGrade = (subjectId: string, quarter: number, scopeKey: string, semester: number) => {
    const grade = getFilteredGrades(scopeKey, semester).find(
      (g) => g.subject_id === subjectId.toString() && g.quarter === quarter,
    );
    if (!grade) return '-';
    const base =
      grade.grade_status === 'inc'
        ? 'INC'
        : grade.grade != null
          ? formatGradeDisplay(toGradePoint(Number(grade.grade)))
          : '-';
    if (grade.is_locked) return `${base} (L)`;
    if (grade.workflow_status === 'for_review') return `${base} (R)`;
    return base;
  };

  const getSubjectFinalDisplay = (subjectId: string, scopeKey: string, semester: number) => {
    const subjectGrades = getFilteredGrades(scopeKey, semester).filter(
      (g) => g.subject_id === subjectId && g.grade_status !== 'inc',
    );
    const final = computeSubjectFinalGrade(subjectGrades);
    if (final == null) return '-';
    return final.toFixed(2);
  };

  const calculateSemesterGWA = (scopeKey: string, semester: number) => {
    const semesterGrades = getFilteredGrades(scopeKey, semester);
    if (semesterGrades.length === 0) return '-';
    return calculateGWA(semesterGrades as { grade: number }[]).toFixed(2);
  };

  const subjectMatchesSearchAndYear = useCallback(
    (ss: { subject?: { name?: string; code?: string; course?: { name?: string }; year_level?: string } }) => {
      const q = filterSearch.trim().toLowerCase();
      const name = String(ss.subject?.name || '').toLowerCase();
      const code = String(ss.subject?.code || '').toLowerCase();
      const course = String(ss.subject?.course?.name || '').toLowerCase();
      if (q && !name.includes(q) && !code.includes(q) && !course.includes(q)) return false;
      if (filterYearLevel && (ss.subject?.year_level || '') !== filterYearLevel) return false;
      return true;
    },
    [filterSearch, filterYearLevel],
  );

  const semesterSubjects = useMemo(
    () => (selectedSchoolYearId ? buildSubjectRows(selectedSchoolYearId, selectedSemester) : []),
    [selectedSchoolYearId, selectedSemester, buildSubjectRows],
  );

  const filteredSemesterSubjects = useMemo(
    () => semesterSubjects.filter(subjectMatchesSearchAndYear),
    [semesterSubjects, subjectMatchesSearchAndYear],
  );

  const groupedGradePanels = useMemo(() => {
    if (selectedSchoolYearId) return null;
    return allYearScopes.map(({ key, label }) => {
      const semestersInScope = [
        ...new Set(
          myGrades
            .filter((g) => scopeKeyFromGrade(g) === key)
            .map((g) => g.semester)
            .filter((s): s is number => s === 1 || s === 2),
        ),
      ].sort();
      const semesterPanels = semestersInScope.map((semester) => {
          const rows = buildSubjectRows(key, semester);
          const filtered = rows.filter(subjectMatchesSearchAndYear);
          return { semester, rows, filtered };
        });
      return { scopeKey: key, title: label, semesterPanels };
    });
  }, [
    selectedSchoolYearId,
    allYearScopes,
    myGrades,
    selectedSemester,
    buildSubjectRows,
    subjectMatchesSearchAndYear,
  ]);

  const subjectCountSummary = useMemo(() => {
    if (selectedSchoolYearId) {
      return { shown: filteredSemesterSubjects.length, total: semesterSubjects.length, grouped: false };
    }
    const panels = groupedGradePanels || [];
    const total = panels.reduce(
      (a, p) => a + p.semesterPanels.reduce((s, sp) => s + sp.rows.length, 0),
      0,
    );
    const shown = panels.reduce(
      (a, p) => a + p.semesterPanels.reduce((s, sp) => s + sp.filtered.length, 0),
      0,
    );
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

  const tableHeaders = [
    'Code',
    'Subject',
    'Prelim',
    'Midterm',
    'Pre-Finals',
    'Finals',
    'Final Grade',
    ...INSIGHT_HEADERS,
  ];

  const renderSubjectRow = (ss: SubjectRow, scopeKey: string, semester: number, rowKey: string) => {
    const subjectGrades = getFilteredGrades(scopeKey, semester).filter((g) => g.subject_id === ss.subject_id);
    const insights = getSubjectInsights(subjectGrades, ss.subject?.name || 'Subject');
    return (
      <tr key={rowKey} className="hover:bg-white/20">
        <td className="px-4 py-3 font-mono text-sm text-gray-600">{ss.subject?.code || '—'}</td>
        <td className="px-4 py-3 font-medium text-gray-800">{ss.subject?.name}</td>
        <td className="px-4 py-3 text-gray-600">{getSubjectGrade(ss.subject_id, 1, scopeKey, semester)}</td>
        <td className="px-4 py-3 text-gray-600">{getSubjectGrade(ss.subject_id, 2, scopeKey, semester)}</td>
        <td className="px-4 py-3 text-gray-600">{getSubjectGrade(ss.subject_id, 3, scopeKey, semester)}</td>
        <td className="px-4 py-3 text-gray-600">{getSubjectGrade(ss.subject_id, 4, scopeKey, semester)}</td>
        <td className="px-4 py-3 font-semibold text-[#800000]">
          {getSubjectFinalDisplay(ss.subject_id, scopeKey, semester)}
        </td>
        <InsightCellHover label={insights.strength} reason={insights.strengthReason} />
        <InsightCellHover label={insights.improve} reason={insights.improveReason} />
        <InsightCellHover label={insights.suggestion} reason={insights.suggestionReason} />
      </tr>
    );
  };

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
            placeholder="Search subject, code, or course…"
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
            Use the search bar above to filter subjects by name, code, or course. Adjust semester and quarter here.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              label="School year"
              value={schoolYearFilter}
              onChange={(e) => setSchoolYearFilter(e.target.value as 'active' | 'all' | string)}
              options={[
                { value: 'active', label: activeSchoolYearId ? 'Active school year' : 'Active school year (none)' },
                { value: 'all', label: 'All school years' },
                ...(schoolYears || []).map((sy: { id: string; name: string }) => ({ value: sy.id, label: sy.name })),
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

      <GlassCard className="p-4 sm:p-6 overflow-x-auto">
        <h2 className="text-xl font-semibold text-[#800000] mb-4">
          {selectedSemester === 1 ? '1st' : '2nd'} Semester Grades
        </h2>
        <p className="mb-3 text-sm text-gray-600">
          School Year: <span className="font-semibold text-[#800000]">{displaySchoolYearLabel}</span>
        </p>
        <p className="mb-4 text-xs text-gray-500">
          Hover Strength, Areas to Improve, or Suggestion for a short explanation. Final Grade is the average of all
          quarters for that subject.
        </p>

        {selectedSchoolYearId ? (
          <>
            {filteredSemesterSubjects.length > 0 && (
              <Table headers={tableHeaders}>
                {filteredSemesterSubjects.map((ss) =>
                  renderSubjectRow(ss, selectedSchoolYearId, selectedSemester, ss.subject_id),
                )}
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
                  <span className="text-2xl font-bold">{calculateSemesterGWA(selectedSchoolYearId, selectedSemester)}</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {(groupedGradePanels || []).map((panel) => {
              const hasContent = panel.semesterPanels.some((sp) => sp.filtered.length > 0 || sp.rows.length > 0);
              if (!hasContent) return null;
              return (
                <div key={panel.scopeKey} className="mb-8 last:mb-0">
                  <h3 className="text-lg font-medium text-[#800000] mb-3">{panel.title}</h3>
                  {panel.semesterPanels.map((sp) => (
                    <div key={`${panel.scopeKey}-${sp.semester}`} className="mb-6 last:mb-0">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">
                        {sp.semester === 1 ? '1st' : '2nd'} Semester
                      </h4>
                      {sp.filtered.length > 0 ? (
                        <>
                          <Table headers={tableHeaders}>
                            {sp.filtered.map((ss) =>
                              renderSubjectRow(
                                ss,
                                panel.scopeKey,
                                sp.semester,
                                `${panel.scopeKey}-${sp.semester}-${ss.subject_id}`,
                              ),
                            )}
                          </Table>
                          <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-[#800000] to-[#d4af37] text-white">
                            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center">
                              <span className="font-semibold">Semester GWA ({panel.title}):</span>
                              <span className="text-2xl font-bold">
                                {calculateSemesterGWA(panel.scopeKey, sp.semester)}
                              </span>
                            </div>
                          </div>
                        </>
                      ) : sp.rows.length === 0 ? (
                        <p className="text-sm text-gray-500 py-2">No grades for this semester in this school year.</p>
                      ) : (
                        <p className="text-sm text-gray-500 py-2">No subjects match your search.</p>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
            {allYearScopes.length === 0 && (
              <p className="text-center text-gray-500 py-8">No grades recorded yet.</p>
            )}
            {allYearScopes.length > 0 && subjectCountSummary.shown === 0 && (
              <p className="text-center text-gray-500 py-8">
                No grades for the selected semester. Try switching to 2nd Semester in filters.
              </p>
            )}
          </>
        )}

        <p className="mt-3 text-xs text-gray-500">Legend: `(L)` locked by admin, `(R)` for admin review.</p>
      </GlassCard>
    </DashboardLayout>
  );
}
