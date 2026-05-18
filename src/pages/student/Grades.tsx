import { useState, useEffect, useMemo, useCallback } from 'react';
import { useGradesAutoRefresh } from '../../lib/useGradesAutoRefresh';
import { ListFilter, Printer, RefreshCw, Search } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Select, Button, PageSkeletonLoader } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase } from '../../lib/supabase';
import { compareAlphabetical, sortByLabel } from '../../lib/sortUtils';
import type { GradeRecord } from '../../lib/studentGradeInsights';
import { StudentAcademicBanner } from '../../components/student/StudentAcademicBanner';
import { StudentOfficialGradeReport } from '../../components/student/StudentOfficialGradeReport';
import {
  buildOfficialGradeReportRows,
  computeReportSemesterGpa,
  formatOfficialStudentName,
  formatReportTitle,
} from '../../lib/officialGradeReport';
import {
  classifyStudentEnrollments,
  type SubjectPrerequisite,
} from '../../lib/studentAcademicRules';
import { getSubjectGradeSemester } from '../../lib/subjectSemester';

/** Grades with no school_year_id (legacy rows) */
const LEGACY_SCHOOL_YEAR_SCOPE = '__legacy__';

type GradeRow = GradeRecord & {
  subject_id?: string;
  subject?: {
    name?: string;
    code?: string;
    semester?: string;
    course?: { name?: string };
    year_level?: string;
    teacher?: { name?: string; first_name?: string; last_name?: string; name_title?: string | null };
  };
  school_year?: { id?: string; name?: string };
  is_locked?: boolean;
  workflow_status?: string;
};

type SubjectRow = { subject_id: string; subject: GradeRow['subject'] };

function scopeKeyFromGrade(g: GradeRow): string {
  return g.school_year_id ? g.school_year_id : LEGACY_SCHOOL_YEAR_SCOPE;
}

export default function StudentGradesPage() {
  const { user } = useAuthStore();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [myGrades, setMyGrades] = useState<GradeRow[]>([]);
  const [prerequisites, setPrerequisites] = useState<SubjectPrerequisite[]>([]);
  const [studentProfile, setStudentProfile] = useState({ grade_level: '', current_semester: 1 });
  const [studentInfo, setStudentInfo] = useState({
    firstName: '',
    lastName: '',
    courseName: '',
    studentNumber: '',
  });
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
        .select('*, user:users(username, first_name, last_name), course:courses(name)')
        .eq('user_id', user?.id)
        .single();

      if (!studentData) return;

      const linkedUser = studentData.user as { username?: string; first_name?: string; last_name?: string } | null;
      setStudentProfile({
        grade_level: studentData.grade_level || '',
        current_semester: studentData.current_semester === 2 ? 2 : 1,
      });
      setStudentInfo({
        firstName: studentData.first_name || linkedUser?.first_name || '',
        lastName: studentData.last_name || linkedUser?.last_name || '',
        courseName: (studentData.course as { name?: string } | null)?.name || '',
        studentNumber: linkedUser?.username || user?.username || '',
      });

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

      const [subjectsRes, gradesRes, prereqRes] = await Promise.all([
        supabase
          .from('student_subjects')
          .select('*, subject:subjects(*, course:courses(*), teacher:users(id, first_name, last_name, name, name_title))')
          .eq('student_id', studentData.id),
        (async () => {
          let q = supabase
            .from('grades')
            .select(
              '*, subject:subjects(*, course:courses(*), teacher:users(id, first_name, last_name, name, name_title)), school_year:school_years(id,name)',
            )
            .eq('student_id', studentData.id);
          if (effectiveSchoolYearId) q = q.eq('school_year_id', effectiveSchoolYearId);
          return q;
        })(),
        supabase.from('subject_prerequisites').select('subject_id, prerequisite_subject_id, minimum_grade'),
      ]);

      setMySubjects(subjectsRes.data || []);
      setMyGrades((gradesRes.data as GradeRow[]) || []);
      setPrerequisites((prereqRes.data || []) as SubjectPrerequisite[]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, schoolYearFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setSelectedSemester(studentProfile.current_semester);
  }, [studentProfile.current_semester]);

  useEffect(() => {
    if (activeSchoolYearId && selectedSchoolYearId === '') {
      setSelectedSchoolYearId(activeSchoolYearId);
    }
  }, [activeSchoolYearId, selectedSchoolYearId]);

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

  const academicView = useMemo(
    () => classifyStudentEnrollments(studentProfile, mySubjects, myGrades, prerequisites),
    [studentProfile, mySubjects, myGrades, prerequisites]
  );

  const visibleSubjectIds = useMemo(
    () =>
      new Set(
        academicView.visible
          .map((v) => v.enrollment.subject?.id || v.enrollment.subject_id)
          .filter(Boolean) as string[]
      ),
    [academicView]
  );

  const hiddenPrerequisiteCount = useMemo(
    () => academicView.hidden.filter((h) => h.hiddenReason === 'prerequisite').length,
    [academicView]
  );

  const buildSubjectRows = useCallback(
    (scopeKey: string, semester: number) => {
      const gradeInScope = myGrades.filter((g) => {
        const yMatch =
          scopeKey === LEGACY_SCHOOL_YEAR_SCOPE ? !g.school_year_id : g.school_year_id === scopeKey;
        return yMatch && g.semester === semester;
      });
      const map = new Map<string, SubjectRow>();
      for (const g of gradeInScope) {
        if (g.subject_id && g.subject && visibleSubjectIds.has(g.subject_id) && !map.has(g.subject_id)) {
          map.set(g.subject_id, { subject_id: g.subject_id, subject: g.subject });
        }
      }
      const scopeIsActiveYear =
        Boolean(activeSchoolYearId && scopeKey === activeSchoolYearId && scopeKey !== LEGACY_SCHOOL_YEAR_SCOPE);
      if (scopeIsActiveYear) {
        for (const row of academicView.visible) {
          const ss = row.enrollment;
          const id = ss.subject?.id || ss.subject_id;
          if (!id || !visibleSubjectIds.has(id) || map.has(id)) continue;
          if (getSubjectGradeSemester(ss.subject) !== semester) continue;
          map.set(id, { subject_id: id, subject: ss.subject });
        }
      }
      return [...map.values()].filter((row) => visibleSubjectIds.has(row.subject_id));
    },
    [myGrades, academicView.visible, activeSchoolYearId, visibleSubjectIds],
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

  const buildOfficialRows = useCallback(
    (scopeKey: string, semester: number, subjects: SubjectRow[]) => {
      const schoolYearId = scopeKey === LEGACY_SCHOOL_YEAR_SCOPE ? null : scopeKey;
      return buildOfficialGradeReportRows(
        subjects,
        myGrades,
        scopeKey,
        semester,
        schoolYearId,
        LEGACY_SCHOOL_YEAR_SCOPE,
      );
    },
    [myGrades],
  );

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

  const studentDisplayName = formatOfficialStudentName(studentInfo.firstName, studentInfo.lastName);
  const studentNumber = studentInfo.studentNumber || user?.username || '—';

  const renderOfficialReport = (scopeKey: string, semester: number, subjects: SubjectRow[], key: string) => {
    const rows = buildOfficialRows(scopeKey, semester, subjects);
    const semesterGpa = computeReportSemesterGpa(rows);
    const schoolYearName =
      scopeKey === LEGACY_SCHOOL_YEAR_SCOPE
        ? 'Unassigned'
        : myGrades.find((g) => g.school_year_id === scopeKey)?.school_year?.name || displaySchoolYearLabel;

    return (
      <StudentOfficialGradeReport
        key={key}
        reportTitle={formatReportTitle(studentProfile.grade_level, semester, schoolYearName)}
        studentName={studentDisplayName}
        studentNumber={studentNumber}
        courseName={studentInfo.courseName || '—'}
        rows={rows}
        semesterGpa={semesterGpa}
      />
    );
  };

  if (loading) {
    return <DashboardLayout title="My Grades"><PageSkeletonLoader rows={4} /></DashboardLayout>;
  }

  return (
    <DashboardLayout title="My Grades">
      <div className="print:hidden">
      <StudentAcademicBanner
        currentSemester={studentProfile.current_semester}
        backSubjectCount={academicView.backSubjects.length}
        hiddenByPrerequisiteCount={hiddenPrerequisiteCount}
      />
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
            Use the search bar above to filter subjects by name, code, or course. Choose{' '}
            <span className="font-semibold">1st Semester</span> to review previous-term subjects after you have been
            advanced.
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

      <div className="mb-5 flex flex-wrap items-end gap-4 max-w-lg">
        <div className="min-w-[200px] flex-1">
          <Select
            label="School year (report)"
            value={selectedSchoolYearId}
            onChange={(e) => setSelectedSchoolYearId(e.target.value)}
            options={schoolYearOptions}
          />
        </div>
        <Button type="button" variant="secondary" className="shrink-0" onClick={() => window.print()}>
          <Printer className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          Print copy of grades
        </Button>
      </div>
      </div>

      <div id="student-grade-report" className="space-y-8 print:space-y-0">
        {selectedSchoolYearId ? (
          <>
            {filteredSemesterSubjects.length > 0 &&
              renderOfficialReport(
                selectedSchoolYearId,
                selectedSemester,
                filteredSemesterSubjects,
                `report-${selectedSchoolYearId}-${selectedSemester}`,
              )}

            {semesterSubjects.length === 0 && (
              <p className="text-center text-gray-500 py-8">No subjects for this semester.</p>
            )}

            {semesterSubjects.length > 0 && filteredSemesterSubjects.length === 0 && (
              <p className="text-center text-gray-500 py-8">No subjects match your search.</p>
            )}

          </>
        ) : (
          <>
            {(groupedGradePanels || []).map((panel) => {
              const hasContent = panel.semesterPanels.some((sp) => sp.filtered.length > 0);
              if (!hasContent) return null;
              return (
                <div key={panel.scopeKey} className="space-y-6">
                  {panel.semesterPanels.map(
                    (sp) =>
                      sp.filtered.length > 0 &&
                      renderOfficialReport(
                        panel.scopeKey,
                        sp.semester,
                        sp.filtered,
                        `${panel.scopeKey}-${sp.semester}`,
                      ),
                  )}
                </div>
              );
            })}
            {allYearScopes.length === 0 && (
              <p className="text-center text-gray-500 py-8">No grades recorded yet.</p>
            )}
            {allYearScopes.length > 0 && subjectCountSummary.shown === 0 && (
              <p className="text-center text-gray-500 py-8">
                No grades for the selected filters. Try another semester or school year.
              </p>
            )}
          </>
        )}

      </div>
    </DashboardLayout>
  );
}
