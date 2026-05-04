import { useState, useEffect, useMemo, useRef } from 'react';
import { AlertTriangle, Download, ListFilter, RefreshCw, Search, Star } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Select, Table, Spinner, Badge, Button, MessageModal, type AppMessagePayload } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, getGradeRemarks, getGradeStatus, isPassing } from '../../lib/supabase';
import { SCHOOL_SECTION_SELECT_OPTIONS, normalizeSchoolSection } from '../../constants/schoolSections';

interface GradeRecord {
  student_name?: string;
  student_id?: string;
  semester?: number;
  quarter?: number;
  grade?: number;
}

export default function TeacherGradesPage() {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [selectedQuarter, setSelectedQuarter] = useState('');
  const [entryGrade, setEntryGrade] = useState('');
  const [entryStatus, setEntryStatus] = useState<'passed' | 'failed' | 'inc'>('passed');
  const [selectedStudentForEntry, setSelectedStudentForEntry] = useState('');
  const [entryStudentSearch, setEntryStudentSearch] = useState('');
  const [uploadResults, setUploadResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [appMessage, setAppMessage] = useState<AppMessagePayload | null>(null);

  const [filterSearch, setFilterSearch] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const refreshEnrolledStudents = async (subjectId: string, allSubjectIds: string[]) => {
    if (!allSubjectIds.length) {
      setEnrolledStudents([]);
      setSelectedStudentForEntry('');
      return;
    }
    if (subjectId) {
      const { data } = await supabase
        .from('student_subjects')
        .select('student:students(*, user:users(*))')
        .eq('subject_id', subjectId);
      const list = (data || []).map((r: any) => r.student).filter(Boolean);
      setEnrolledStudents(list);
      setSelectedStudentForEntry((prev) => (list.some((s: any) => s.id === prev) ? prev : list[0]?.id ?? ''));
      return;
    }
    const { data } = await supabase
      .from('student_subjects')
      .select('student:students(*, user:users(*))')
      .in('subject_id', allSubjectIds);
    const byId = new Map<string, any>();
    (data || []).forEach((r: any) => {
      const st = r.student;
      if (st?.id && !byId.has(st.id)) byId.set(st.id, st);
    });
    const list = Array.from(byId.values());
    setEnrolledStudents(list);
    setSelectedStudentForEntry((prev) => (list.some((s: any) => s.id === prev) ? prev : list[0]?.id ?? ''));
  };

  const loadData = async () => {
    try {
      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('*, course:courses(*)')
        .eq('teacher_id', user?.id);
      const teacherSubjects = subjectsData || [];
      setMySubjects(teacherSubjects);
      const subjectIds = teacherSubjects.map((s) => s.id);
      if (teacherSubjects.length) {
        const requestedSubjectId = searchParams.get('subject');
        const hasRequestedSubject =
          requestedSubjectId && requestedSubjectId !== 'all' && teacherSubjects.some((s) => s.id === requestedSubjectId);
        const initialSubjectId = hasRequestedSubject ? (requestedSubjectId as string) : '';
        setSelectedSubject(initialSubjectId);
        if (initialSubjectId) {
          setSearchParams({ subject: initialSubjectId }, { replace: true });
        } else {
          setSearchParams({ subject: 'all' }, { replace: true });
        }
        await refreshEnrolledStudents(initialSubjectId, subjectIds);
      }

      if (subjectIds.length === 0) {
        setGrades([]);
        setStudents([]);
        setSelectedSubject('');
        setEnrolledStudents([]);
        return;
      }

      const [studentSubjectsRes, gradesRes] = await Promise.all([
        supabase.from('student_subjects').select('student_id').in('subject_id', subjectIds),
        supabase.from('grades').select('*').in('subject_id', subjectIds),
      ]);

      setGrades(gradesRes.data || []);

      const studentIds = Array.from(new Set((studentSubjectsRes.data || []).map((r) => r.student_id)));
      if (studentIds.length === 0) {
        setStudents([]);
        return;
      }
      const { data: studentsData } = await supabase
        .from('students')
        .select('*, user:users(*)')
        .in('id', studentIds);
      setStudents(studentsData || []);
    } finally {
      setLoading(false);
    }
  };

  const saveGradeEntry = async () => {
    if (!selectedSubject || !selectedStudentForEntry) return;
    const value = parseFloat(entryGrade);
    if (entryStatus !== 'inc' && (Number.isNaN(value) || value < 0 || value > 100)) {
      setAppMessage({ title: 'Invalid grade', message: 'Enter a number between 0 and 100.', variant: 'warning' });
      return;
    }
    const existing = grades.find(
      (g) =>
        g.student_id === selectedStudentForEntry &&
        g.subject_id === selectedSubject &&
        g.semester === selectedSemester &&
        g.quarter.toString() === (selectedQuarter || '1')
    );
    const quarterValue = selectedQuarter ? parseInt(selectedQuarter, 10) : 1;
    if (existing?.grade_status === 'inc') {
      setAppMessage({
        title: 'Restricted grade update',
        message: 'This grade is marked INC. Ask an admin to update INC records.',
        variant: 'warning',
      });
      return;
    }
    const payload =
      entryStatus === 'inc'
        ? { grade: 0, remarks: 'INC', grade_status: 'inc' as const }
        : { grade: value, remarks: getGradeRemarks(value), grade_status: getGradeStatus(value) };
    try {
      if (existing) {
        const { error } = await supabase
          .from('grades')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('grades').insert({
          student_id: selectedStudentForEntry,
          subject_id: selectedSubject,
          semester: selectedSemester,
          quarter: quarterValue,
          ...payload,
        });
        if (error) throw error;
      }
      setEntryGrade('');
      setEntryStatus('passed');
      await loadData();
      await refreshEnrolledStudents(selectedSubject, mySubjects.map((s) => s.id));
      setAppMessage({ title: 'Grade saved', message: 'Grade entry recorded successfully.', variant: 'success' });
    } catch (err: any) {
      setAppMessage({
        title: 'Save failed',
        message: err?.message || 'Grade could not be saved. Please try again.',
        variant: 'error',
      });
    }
  };

  const downloadTemplate = () => {
    const template = [
      { student_name: 'Juan Dela Cruz', semester: selectedSemester, quarter: selectedQuarter || 1, grade: 85 },
      { student_name: 'Juan Dela Cruz', semester: selectedSemester, quarter: selectedQuarter || 2, grade: 88 },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Grades');
    XLSX.writeFile(wb, 'grade_template.xlsx');
  };

  const processFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSubject) {
      setAppMessage({ title: 'Select a subject', message: 'Choose a subject before uploading.', variant: 'warning' });
      return;
    }
    setUploading(true);
    setUploadResults(null);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<GradeRecord>(sheet);

      const { data: studentSubjects } = await supabase
        .from('student_subjects')
        .select('*, student:students(*)')
        .eq('subject_id', selectedSubject);
      const subjectStudents = studentSubjects?.map((ss: any) => ss.student) || [];

      let success = 0;
      let failed = 0;
      const errors: string[] = [];
      for (const row of rows) {
        try {
          let sid = row.student_id;
          if (!sid && row.student_name) {
            const n = row.student_name.trim().toLowerCase();
            const match = subjectStudents.find(
              (s: any) => `${s.first_name || ''} ${s.last_name || ''}`.trim().toLowerCase() === n
            );
            sid = match?.id;
          }
          if (!sid) {
            failed++;
            errors.push(`Student not found: ${row.student_name || row.student_id}`);
            continue;
          }
          const semester = Number(row.semester) || selectedSemester;
          const quarter = Number(row.quarter) || Number(selectedQuarter || '1');
          const grade = Number(row.grade);
          if (Number.isNaN(grade) || grade < 0 || grade > 100) {
            failed++;
            errors.push(`Invalid grade for ${row.student_name || row.student_id}`);
            continue;
          }
          const { data: existing } = await supabase
            .from('grades')
            .select('id')
            .eq('student_id', sid)
            .eq('subject_id', selectedSubject)
            .eq('semester', semester)
            .eq('quarter', quarter)
            .limit(1);
          if (existing && existing.length > 0) {
            const existingGrade = grades.find((g) => g.id === existing[0].id);
            if (existingGrade?.grade_status === 'inc') {
              failed++;
              errors.push(`INC grade cannot be updated by teacher: ${row.student_name || row.student_id}`);
              continue;
            }
            const { error: updateError } = await supabase
              .from('grades')
              .update({ grade, remarks: getGradeRemarks(grade), grade_status: getGradeStatus(grade) })
              .eq('id', existing[0].id);
            if (updateError) throw updateError;
          } else {
            const { error: insertError } = await supabase.from('grades').insert({
              student_id: sid,
              subject_id: selectedSubject,
              semester,
              quarter,
              grade,
              remarks: getGradeRemarks(grade),
              grade_status: getGradeStatus(grade),
            });
            if (insertError) throw insertError;
          }
          success++;
        } catch (err: any) {
          failed++;
          errors.push(err.message || 'Row processing failed');
        }
      }

      setUploadResults({ success, failed, errors: errors.slice(0, 10) });
      await loadData();
      await refreshEnrolledStudents(selectedSubject, mySubjects.map((s) => s.id));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const baseGrades = useMemo(() => {
    const subjectIds = mySubjects.map((s) => s.id);
    const matchesSubject = (g: any) =>
      selectedSubject ? g.subject_id === selectedSubject : subjectIds.includes(g.subject_id);
    return grades.filter(
      (g) =>
        matchesSubject(g) &&
        g.semester === selectedSemester &&
        (!selectedQuarter || g.quarter.toString() === selectedQuarter)
    );
  }, [grades, selectedSubject, selectedSemester, selectedQuarter, mySubjects]);

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

  const filteredEntryStudents = useMemo(() => {
    const q = entryStudentSearch.trim().toLowerCase();
    return enrolledStudents.filter((s: any) => {
      const name = `${s.first_name || ''} ${s.last_name || ''}`.trim().toLowerCase();
      if (q && !name.includes(q)) return false;
      if (filterSection && normalizeSchoolSection(s.section) !== filterSection) return false;
      return true;
    });
  }, [enrolledStudents, entryStudentSearch, filterSection]);

  const hasActiveFilters =
    Boolean(filterSearch.trim()) ||
    Boolean(filterSection) ||
    selectedSemester !== 1 ||
    selectedQuarter !== '' ||
    Boolean(selectedSubject);

  const studentPerformanceInsights = useMemo(() => {
    const summary = new Map<
      string,
      {
        studentName: string;
        gradeLevel: string;
        section: string;
        total: number;
        count: number;
        failingCount: number;
      }
    >();

    filteredGrades.forEach((grade) => {
      const st = students.find((s) => s.id === grade.student_id);
      const studentName = st ? `${st.first_name} ${st.last_name}` : 'Unknown';
      const current = summary.get(grade.student_id) || {
        studentName,
        gradeLevel: st?.grade_level || '-',
        section: st?.section || '-',
        total: 0,
        count: 0,
        failingCount: 0,
      };
      current.total += Number(grade.grade) || 0;
      current.count += 1;
      if (!isPassing(grade.grade)) current.failingCount += 1;
      summary.set(grade.student_id, current);
    });

    const rows = Array.from(summary.values()).map((entry) => ({
      ...entry,
      average: entry.count ? entry.total / entry.count : 0,
      key: `${entry.studentName}-${entry.gradeLevel}-${entry.section}`,
    }));

    return {
      topPerformers: rows
        .filter((entry) => entry.average >= 85 && entry.failingCount === 0)
        .sort((a, b) => b.average - a.average)
        .slice(0, 5),
      atRiskStudents: rows
        .filter((entry) => entry.average < 75 || entry.failingCount > 0)
        .sort((a, b) => b.failingCount - a.failingCount || a.average - b.average)
        .slice(0, 5),
    };
  }, [filteredGrades, students]);

  const clearFilters = () => {
    setFilterSearch('');
    setFilterSection('');
    setSelectedSemester(1);
    setSelectedQuarter('');
    setSelectedSubject('');
    setSearchParams({ subject: 'all' }, { replace: true });
    void refreshEnrolledStudents('', mySubjects.map((s) => s.id));
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
      
      <div className="mb-4 text-sm text-gray-600">
        {mySubjects.length === 0 ? (
          <span className="text-gray-500">No subjects assigned.</span>
        ) : (
          <>
            Viewing{' '}
            <span className="font-semibold text-[#800000]">
              {selectedSubject ? mySubjects.find((s) => s.id === selectedSubject)?.name || 'Subject' : 'All subjects'}
            </span>
            {' · '}
            {selectedSemester === 1 ? '1st' : '2nd'} semester
            {' · '}
            {selectedQuarter === ''
              ? 'All quarters'
              : ['', 'Prelim', 'Midterm', 'Pre-Finals', 'Finals'][Number(selectedQuarter)] || 'Quarter'}
          </>
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
        {!filtersOpen && (
          <span className="text-sm text-gray-600">
            Showing <span className="font-semibold text-[#800000]">{filteredGrades.length}</span> / {baseGrades.length}{' '}
            grade{baseGrades.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {filtersOpen && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 animate-fade-in">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-[#800000]">Filters</h2>
            {hasActiveFilters && (
              <Button type="button" variant="secondary" className="w-full shrink-0 sm:w-auto" onClick={clearFilters}>
                <RefreshCw className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                Clear filters
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label="Subject"
              value={`${selectedSubject}`}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedSubject(v);
                if (v) setSearchParams({ subject: v }, { replace: true });
                else setSearchParams({ subject: 'all' }, { replace: true });
                void refreshEnrolledStudents(v, mySubjects.map((s) => s.id));
              }}
              options={
                mySubjects.length
                  ? [
                      { value: '', label: 'All subjects' },
                      ...mySubjects.map((s) => ({ value: `${s.id}`, label: `${s.name} — ${s.course?.name || ''}` })),
                    ]
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

      <GlassCard variant="plain" className="mb-6 p-4 sm:p-6">
        <h2 className="mb-3 text-lg font-semibold text-[#800000]">Quick grade entry</h2>
        {!selectedSubject && mySubjects.length > 0 && (
          <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Open the filter panel (filter icon) and choose a specific subject to enter or update a grade for one student.
          </p>
        )}
        <div className="mb-4 w-full md:max-w-sm">
          <label htmlFor="grade-entry-student-search" className="sr-only">Search student for entry</label>
          <input
            id="grade-entry-student-search"
            type="search"
            placeholder="Filter students for entry..."
            value={entryStudentSearch}
            onChange={(e) => setEntryStudentSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Select
            label="Student"
            value={selectedStudentForEntry}
            onChange={(e) => setSelectedStudentForEntry(e.target.value)}
            options={[
              { value: '', label: filteredEntryStudents.length ? 'Select student' : 'No matching students' },
              ...filteredEntryStudents.map((s: any) => ({ value: s.id, label: `${s.first_name} ${s.last_name}` })),
            ]}
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
            value={selectedQuarter || '1'}
            onChange={(e) => setSelectedQuarter(e.target.value)}
            options={[
              { value: '1', label: 'Prelim' },
              { value: '2', label: 'Midterm' },
              { value: '3', label: 'Pre-Finals' },
              { value: '4', label: 'Finals' },
            ]}
          />
          <div>
            <label className="ml-1 block text-sm font-medium text-gray-700">Grade entry</label>
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${entryStatus !== 'inc' ? 'bg-[#800000] text-white' : 'bg-gray-100 text-gray-700'}`}
                onClick={() => setEntryStatus('passed')}
              >
                Numeric
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${entryStatus === 'inc' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                onClick={() => setEntryStatus('inc')}
              >
                INC
              </button>
            </div>
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={entryGrade}
              onChange={(e) => setEntryGrade(e.target.value)}
              disabled={entryStatus === 'inc'}
              placeholder={entryStatus === 'inc' ? 'Will be saved as INC' : '0 - 100'}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-base text-gray-900"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
          {[75, 80, 85, 90, 95].map((preset) => (
            <button
              key={preset}
              type="button"
              className="rounded-lg border border-gray-300 px-2.5 py-1 hover:bg-gray-50"
              onClick={() => {
                setEntryStatus('passed');
                setEntryGrade(String(preset));
              }}
            >
              {preset}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <Button type="button" disabled={!selectedSubject} onClick={() => void saveGradeEntry()}>
            Save grade entry
          </Button>
        </div>
      </GlassCard>

      <GlassCard variant="plain" className="mb-6 p-4 sm:p-6">
        <h2 className="mb-2 text-lg font-semibold text-[#800000]">Upload grades (Excel/CSV)</h2>
        <p className="mb-4 text-sm text-gray-600">Columns: `student_name`, `semester`, `quarter`, `grade`.</p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={processFile}
            className="w-full min-w-0 text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-[#800000] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#600000]"
          />
          <Button type="button" variant="secondary" onClick={downloadTemplate}>
            <Download className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            Download template
          </Button>
        </div>
        {uploading && <div className="mt-4"><Spinner size="sm" /></div>}
        {uploadResults && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-center">
              <p className="text-xl font-bold text-green-600">{uploadResults.success}</p>
              <p className="text-sm text-green-700">Updated</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center">
              <p className="text-xl font-bold text-red-600">{uploadResults.failed}</p>
              <p className="text-sm text-red-700">Failed</p>
            </div>
          </div>
        )}
      </GlassCard>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GlassCard variant="plain" className="p-4 sm:p-6">
          <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-green-800 sm:text-lg">
            <Star className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            Top performers in current view
          </h3>
          {studentPerformanceInsights.topPerformers.length === 0 ? (
            <p className="text-sm text-gray-600">No top performers yet for this filtered view.</p>
          ) : (
            <ul className="space-y-2">
              {studentPerformanceInsights.topPerformers.map((student) => (
                <li
                  key={student.key}
                  className="rounded-xl border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900"
                >
                  <span className="font-semibold">{student.studentName}</span>
                  <span className="ml-2">({student.gradeLevel} • {student.section})</span>
                  <span className="ml-2 font-semibold">Avg {student.average.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard variant="plain" className="p-4 sm:p-6">
          <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-red-800 sm:text-lg">
            <AlertTriangle className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            At-risk / failing in current view
          </h3>
          {studentPerformanceInsights.atRiskStudents.length === 0 ? (
            <p className="text-sm text-gray-600">No at-risk students in this filtered view.</p>
          ) : (
            <ul className="space-y-2">
              {studentPerformanceInsights.atRiskStudents.map((student) => (
                <li
                  key={student.key}
                  className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900"
                >
                  <span className="font-semibold">{student.studentName}</span>
                  <span className="ml-2">({student.gradeLevel} • {student.section})</span>
                  <span className="ml-2 font-semibold">Avg {student.average.toFixed(2)}</span>
                  {student.failingCount > 0 && (
                    <span className="ml-2 font-semibold">{student.failingCount} failing grade{student.failingCount > 1 ? 's' : ''}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      <GlassCard className="p-4 sm:p-6">
        <p className="mb-3 text-xs text-gold-100/90 sm:text-sm">
          Row highlight guide: <span className="font-semibold text-green-200">green</span> = excellent (90+),{' '}
          <span className="font-semibold text-red-200">red</span> = failing (&lt;75).
        </p>
        <Table headers={['Student', 'Subject', 'Semester', 'Quarter', 'Grade', 'Remarks', 'Status']}>
          {filteredGrades.map((grade) => {
            const failing = !isPassing(grade.grade);
            const excellent = Number(grade.grade) >= 90;
            const rowClassName = failing
              ? 'border-l-4 border-red-600 bg-red-200/95 hover:bg-red-200'
              : excellent
                ? 'border-l-4 border-green-600 bg-green-200/90 hover:bg-green-200'
                : 'hover:bg-white/20';
            return (
            <tr key={grade.id} className={rowClassName}>
              <td className={`px-4 py-3 font-semibold ${failing ? 'text-red-950' : excellent ? 'text-green-950' : 'text-gray-800'}`}>{getStudentName(grade.student_id)}</td>
              <td className={`px-4 py-3 ${failing ? 'text-red-900' : excellent ? 'text-green-900' : 'text-gray-600'}`}>{getSubjectName(grade.subject_id)}</td>
              <td className={`px-4 py-3 ${failing ? 'text-red-900' : excellent ? 'text-green-900' : 'text-gray-600'}`}>{grade.semester === 1 ? '1st Sem' : '2nd Sem'}</td>
              <td className={`px-4 py-3 ${failing ? 'text-red-900' : excellent ? 'text-green-900' : 'text-gray-600'}`}>
                {['', 'Prelim', 'Midterm', 'Pre-Finals', 'Finals'][grade.quarter]}
              </td>
              <td className="px-4 py-3 font-medium text-gray-800">{grade.grade_status === 'inc' ? 'INC' : grade.grade}</td>
              <td className={`px-4 py-3 ${failing ? 'text-red-900' : excellent ? 'text-green-900' : 'text-gray-600'}`}>{grade.remarks || '—'}</td>
              <td className="px-4 py-3">
                <Badge
                  variant={
                    grade.grade_status === 'inc'
                      ? 'warning'
                      : grade.grade_status === 'passed' || isPassing(grade.grade)
                        ? 'success'
                        : 'danger'
                  }
                  className={
                    grade.grade_status === 'inc'
                      ? '!bg-amber-600 !text-white !border-amber-700'
                      : grade.grade_status === 'passed' || isPassing(grade.grade)
                        ? '!bg-green-600 !text-white !border-green-700'
                        : '!bg-red-600 !text-white !border-red-700'
                  }
                >
                  {grade.grade_status === 'inc' ? 'INC' : grade.grade_status === 'passed' ? 'PASSED' : 'FAILED'}
                </Badge>
              </td>
            </tr>
          )})}
        </Table>
        {baseGrades.length === 0 && (
          <p className="text-center text-gray-500 py-8">No grades match subject / semester / quarter.</p>
        )}
        {baseGrades.length > 0 && filteredGrades.length === 0 && (
          <p className="text-center text-gray-500 py-8">No rows match your search or section filter.</p>
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
