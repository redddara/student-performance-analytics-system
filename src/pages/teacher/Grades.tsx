import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AlertTriangle, Download, ListFilter, Lock, RefreshCw, Search, Star, Unlock } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Select, Table, Spinner, Badge, Button, MessageModal, PageSkeletonLoader, type AppMessagePayload } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, getGradeRemarks, getGradeStatus, isPassing } from '../../lib/supabase';
import { useGradesAutoRefresh } from '../../lib/useGradesAutoRefresh';
import { SCHOOL_SECTION_SELECT_OPTIONS, normalizeSchoolSection } from '../../constants/schoolSections';
import {
  buildBulkGradePreview,
  buildExistingGradesLookup,
  quarterLabel,
  type BulkGradePreviewRow,
  type GradeSpreadsheetRow,
  type ExistingGradeLite,
  type EnrolledStudentLite,
} from '../../lib/bulkGradeUploadPreview';

const yearLevelRank = (value?: string | null) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized.startsWith('1')) return 1;
  if (normalized.startsWith('2')) return 2;
  if (normalized.startsWith('3')) return 3;
  if (normalized.startsWith('4')) return 4;
  return 0;
};

export default function TeacherGradesPage() {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadParsing, setUploadParsing] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkPreviewRows, setBulkPreviewRows] = useState<BulkGradePreviewRow[] | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'errors'>('all');
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
  const [requestingUnlock, setRequestingUnlock] = useState(false);
  const [submittingForReview, setSubmittingForReview] = useState(false);
  const [activeSchoolYearId, setActiveSchoolYearId] = useState<string | null>(null);
  const [classRecordDrafts, setClassRecordDrafts] = useState<Record<string, string>>({});
  const [classRecordSavingKey, setClassRecordSavingKey] = useState('');

  const [filterSearch, setFilterSearch] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [gradeTablePage, setGradeTablePage] = useState(1);
  const [gradeTablePageSize, setGradeTablePageSize] = useState(10);

  const refreshEnrolledStudents = useCallback(async (subjectId: string, allSubjectIds: string[]) => {
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
      const list = (data || [])
        .map((r: any) => r.student)
        .filter((s: any) => Boolean(s) && (s.student_status == null || s.student_status === 'active'));
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
      if (st?.id && (st.student_status == null || st.student_status === 'active') && !byId.has(st.id)) {
        byId.set(st.id, st);
      }
    });
    const list = Array.from(byId.values());
    setEnrolledStudents(list);
    setSelectedStudentForEntry((prev) => (list.some((s: any) => s.id === prev) ? prev : list[0]?.id ?? ''));
  }, []);

  const loadData = useCallback(async () => {
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
        (async () => {
          try {
            const { data: activeSy, error: syError } = await supabase
              .from('school_years')
              .select('id')
              .eq('is_active', true)
              .maybeSingle();
            if (syError) throw syError;
            setActiveSchoolYearId(activeSy?.id ?? null);
            let query = supabase.from('grades').select('*').in('subject_id', subjectIds);
            if (activeSy?.id) query = query.eq('school_year_id', activeSy.id);
            return query;
          } catch {
            // Backward-compat: if migration not applied yet, fall back to all grades.
            setActiveSchoolYearId(null);
            return supabase.from('grades').select('*').in('subject_id', subjectIds);
          }
        })(),
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
  }, [user?.id, searchParams, setSearchParams, refreshEnrolledStudents]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useGradesAutoRefresh(loadData, user?.id ? `grades-live:teacher-grades:${user.id}` : null);

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
    const anyLockedForSubjectSemester = grades.some(
      (g) =>
        g.student_id === selectedStudentForEntry &&
        g.subject_id === selectedSubject &&
        g.semester === selectedSemester &&
        Boolean(g.is_locked)
    );
    const quarterValue = selectedQuarter ? parseInt(selectedQuarter, 10) : 1;
    if (existing?.is_locked || anyLockedForSubjectSemester) {
      setAppMessage({
        title: 'Grade is locked',
        message: 'This subject grade set is locked after admin approval. Request unlock first.',
        variant: 'warning',
      });
      return;
    }
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
          school_year_id: activeSchoolYearId,
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

  const submitCurrentScopeForReview = async () => {
    if (!selectedSubject) {
      setAppMessage({ title: 'Select a subject', message: 'Choose a specific subject first.', variant: 'warning' });
      return;
    }
    setSubmittingForReview(true);
    try {
      let query = supabase
        .from('grades')
        .update({ workflow_status: 'for_review' })
        .eq('subject_id', selectedSubject)
        .eq('semester', selectedSemester)
        .eq('is_locked', false);
      if (selectedQuarter) query = query.eq('quarter', Number(selectedQuarter));
      const { error } = await query;
      if (error) throw error;
      await loadData();
      setAppMessage({
        title: 'Submitted for review',
        message: 'Current grade scope is now marked For Review.',
        variant: 'success',
      });
    } catch (err: any) {
      setAppMessage({
        title: 'Submit failed',
        message: err?.message || 'Could not submit grades for review.',
        variant: 'error',
      });
    } finally {
      setSubmittingForReview(false);
    }
  };

  const requestUnlockCurrentScope = async () => {
    if (!selectedSubject) {
      setAppMessage({ title: 'Select a subject', message: 'Choose a specific subject first.', variant: 'warning' });
      return;
    }
    setRequestingUnlock(true);
    try {
      let query = supabase
        .from('grades')
        .update({
          unlock_requested: true,
          unlock_reason: 'Teacher requested correction.',
          unlock_requested_at: new Date().toISOString(),
          unlock_requested_by: user?.id ?? null,
        })
        .eq('subject_id', selectedSubject)
        .eq('semester', selectedSemester)
        .eq('is_locked', true);
      if (selectedQuarter) query = query.eq('quarter', Number(selectedQuarter));
      const { error } = await query;
      if (error) throw error;
      await loadData();
      setAppMessage({
        title: 'Unlock requested',
        message: 'Admin can now review and approve this unlock request.',
        variant: 'success',
      });
    } catch (err: any) {
      setAppMessage({
        title: 'Request failed',
        message: err?.message || 'Could not request unlock.',
        variant: 'error',
      });
    } finally {
      setRequestingUnlock(false);
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
    setUploadParsing(true);
    setUploadResults(null);
    setBulkPreviewRows(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<GradeSpreadsheetRow>(sheet);

      if (!rows.length) {
        setAppMessage({
          title: 'No rows in file',
          message: 'The spreadsheet appears empty below the header row.',
          variant: 'warning',
        });
        return;
      }

      await buildBulkGradePreviewSheet(rows);
    } catch {
      setAppMessage({
        title: 'Could not read file',
        message: 'Check that the file is a valid spreadsheet and try again.',
        variant: 'error',
      });
    } finally {
      setUploadParsing(false);
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

  const quickEntryLocked = useMemo(() => {
    if (!selectedSubject || !selectedStudentForEntry) return false;
    return grades.some(
      (g) =>
        g.student_id === selectedStudentForEntry &&
        g.subject_id === selectedSubject &&
        g.semester === selectedSemester &&
        Boolean(g.is_locked)
    );
  }, [grades, selectedSubject, selectedStudentForEntry, selectedSemester]);

  const totalGradePages = useMemo(
    () => Math.max(1, Math.ceil(filteredGrades.length / gradeTablePageSize)),
    [filteredGrades.length, gradeTablePageSize]
  );

  const paginatedGrades = useMemo(() => {
    const start = (gradeTablePage - 1) * gradeTablePageSize;
    return filteredGrades.slice(start, start + gradeTablePageSize);
  }, [filteredGrades, gradeTablePage, gradeTablePageSize]);

  useEffect(() => {
    setGradeTablePage(1);
  }, [filterSearch, filterSection, selectedSubject, selectedSemester, selectedQuarter, gradeTablePageSize]);

  useEffect(() => {
    setGradeTablePage((prev) => Math.min(prev, totalGradePages));
  }, [totalGradePages]);

  useEffect(() => {
    setBulkPreviewRows(null);
    setPreviewFilter('all');
    setUploadResults(null);
  }, [selectedSubject, selectedSemester, selectedQuarter]);

  useEffect(() => {
    // Prevent stale draft values from a different subject/semester.
    setClassRecordDrafts({});
  }, [selectedSubject, selectedSemester]);

  const bulkPreviewSummary = useMemo(() => {
    if (!bulkPreviewRows) return null;
    const valid = bulkPreviewRows.filter((r) => r.ok).length;
    return { total: bulkPreviewRows.length, valid, errors: bulkPreviewRows.length - valid };
  }, [bulkPreviewRows]);

  const filteredBulkPreviewRows = useMemo(() => {
    if (!bulkPreviewRows) return [];
    if (previewFilter === 'valid') return bulkPreviewRows.filter((r) => r.ok);
    if (previewFilter === 'errors') return bulkPreviewRows.filter((r) => !r.ok);
    return bulkPreviewRows;
  }, [bulkPreviewRows, previewFilter]);

  const buildBulkGradePreviewSheet = useCallback(async (rows: GradeSpreadsheetRow[]) => {
    const { data: studentSubjects } = await supabase
      .from('student_subjects')
      .select('*, student:students(*)')
      .eq('subject_id', selectedSubject);

    const enrolled: EnrolledStudentLite[] =
      studentSubjects?.map((ss: { student?: EnrolledStudentLite }) => ss.student).filter(Boolean) || [];

    const { data: existingGradeRows } = await supabase
      .from('grades')
      .select('id, student_id, semester, quarter, grade_status, grade')
      .eq('subject_id', selectedSubject);

    const existingLookup = buildExistingGradesLookup(((existingGradeRows || []) as ExistingGradeLite[]) ?? []);

    const defaultQuarterNum = Number(selectedQuarter || '1');
    const preview = buildBulkGradePreview(rows, {
      enrolled,
      strategy: 'full_name',
      defaultSemester: selectedSemester,
      defaultQuarter: defaultQuarterNum,
      existingLookup,
    });

    setBulkPreviewRows(preview);
    setPreviewFilter('all');
    setUploadResults(null);
  }, [selectedSubject, selectedSemester, selectedQuarter]);

  const discardBulkGradePreview = () => {
    setBulkPreviewRows(null);
    setPreviewFilter('all');
    setUploadResults(null);
  };

  const confirmBulkGradeUpload = async () => {
    if (!bulkPreviewRows?.length || !selectedSubject || bulkSaving) return;
    const toSave = bulkPreviewRows.filter((r) => r.ok && r.studentId && r.numericGrade != null);
    if (!toSave.length) return;

    setBulkSaving(true);
    setUploadResults(null);
    try {
      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const pr of toSave) {
        try {
          const grade = pr.numericGrade as number;
          const lockedSet = grades.some(
            (g) =>
              g.student_id === pr.studentId &&
              g.subject_id === selectedSubject &&
              g.semester === pr.semester &&
              Boolean(g.is_locked)
          );
          if (lockedSet) {
            throw new Error('Grade set is locked by admin approval.');
          }
          if (pr.existingGradeId) {
            const { error: updateError } = await supabase
              .from('grades')
              .update({ grade, remarks: getGradeRemarks(grade), grade_status: getGradeStatus(grade) })
              .eq('id', pr.existingGradeId);
            if (updateError) throw updateError;
          } else {
            const { error: insertError } = await supabase.from('grades').insert({
              student_id: pr.studentId,
              subject_id: selectedSubject,
              semester: pr.semester,
              quarter: pr.quarter,
              school_year_id: activeSchoolYearId,
              grade,
              remarks: getGradeRemarks(grade),
              grade_status: getGradeStatus(grade),
            });
            if (insertError) throw insertError;
          }
          success++;
        } catch (err: unknown) {
          failed++;
          const msg =
            typeof err === 'object' && err !== null && 'message' in err
              ? String((err as { message?: unknown }).message)
              : 'Save failed';
          errors.push(`${pr.resolvedName}: ${msg}`);
        }
      }

      setBulkPreviewRows(null);
      setPreviewFilter('all');
      setUploadResults({ success, failed, errors: errors.slice(0, 10) });
      await loadData();
      await refreshEnrolledStudents(selectedSubject, mySubjects.map((s) => s.id));
    } finally {
      setBulkSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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

  const classRecordRows = useMemo(() => {
    if (!selectedSubject) return [];
    const enrolled = enrolledStudents;
    const gradesByStudentQuarter = new Map<string, Record<number, any>>();
    grades
      .filter((g) => g.subject_id === selectedSubject && g.semester === selectedSemester)
      .forEach((g) => {
        const key = g.student_id;
        const existing = gradesByStudentQuarter.get(key) || {};
        existing[g.quarter] = g;
        gradesByStudentQuarter.set(key, existing);
      });

    return enrolled.map((student: any) => {
      const byQuarter = gradesByStudentQuarter.get(student.id) || {};
      const q1 = byQuarter[1];
      const q2 = byQuarter[2];
      const q3 = byQuarter[3];
      const q4 = byQuarter[4];
      const values = [q1, q2, q3, q4].filter(Boolean).filter((g: any) => g.grade_status !== 'inc').map((g: any) => Number(g.grade));
      const finalGrade = values.length ? Math.round((values.reduce((a: number, b: number) => a + b, 0) / values.length) * 100) / 100 : null;
      const encodedCount = [q1, q2, q3, q4].filter(Boolean).length;
      const completionStatus = encodedCount === 0 ? 'none' : encodedCount < 4 ? 'partial' : 'complete';
      const locked = [q1, q2, q3, q4].some((g: any) => Boolean(g?.is_locked));
      return {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        q1: q1?.grade_status === 'inc' ? 'INC' : q1?.grade ?? '—',
        q2: q2?.grade_status === 'inc' ? 'INC' : q2?.grade ?? '—',
        q3: q3?.grade_status === 'inc' ? 'INC' : q3?.grade ?? '—',
        q4: q4?.grade_status === 'inc' ? 'INC' : q4?.grade ?? '—',
        finalGrade: finalGrade ?? '—',
        remarks: locked ? 'Locked' : finalGrade == null ? 'In Progress' : finalGrade >= 75 ? 'Passed' : 'Failed',
        completionStatus,
        locked,
      };
    });
  }, [selectedSubject, selectedSemester, enrolledStudents, grades]);

  const classRecordCellKey = (studentId: string, quarter: number) =>
    `${selectedSubject || 'all'}:${selectedSemester}:${studentId}:${quarter}`;

  const getClassRecordInputValue = (studentId: string, quarter: number, current: string | number) => {
    const draft = classRecordDrafts[classRecordCellKey(studentId, quarter)];
    if (draft != null) return draft;
    if (current === '—' || current === 'INC') return '';
    return String(current);
  };

  const updateClassRecordDraft = (studentId: string, quarter: number, value: string) => {
    const key = classRecordCellKey(studentId, quarter);
    setClassRecordDrafts((prev) => ({ ...prev, [key]: value }));
  };

  const saveClassRecordCell = async (studentId: string, quarter: number, currentValue: string | number) => {
    if (!selectedSubject) return;
    const key = `${studentId}:${quarter}`;
    const raw = getClassRecordInputValue(studentId, quarter, currentValue).trim();
    if (!raw) {
      setAppMessage({ title: 'Invalid grade', message: 'Enter a numeric grade from 0 to 100.', variant: 'warning' });
      return;
    }
    const numeric = Number(raw);
    if (Number.isNaN(numeric) || numeric < 0 || numeric > 100) {
      setAppMessage({ title: 'Invalid grade', message: 'Enter a numeric grade from 0 to 100.', variant: 'warning' });
      return;
    }

    const lockedSet = grades.some(
      (g) =>
        g.student_id === studentId &&
        g.subject_id === selectedSubject &&
        g.semester === selectedSemester &&
        Boolean(g.is_locked)
    );
    if (lockedSet) {
      setAppMessage({
        title: 'Grade is locked',
        message: 'This subject grade set is locked after admin approval. Request unlock first.',
        variant: 'warning',
      });
      return;
    }

    setClassRecordSavingKey(key);
    try {
      const existing = grades.find(
        (g) =>
          g.student_id === studentId &&
          g.subject_id === selectedSubject &&
          g.semester === selectedSemester &&
          g.quarter === quarter
      );
      const payload = {
        grade: numeric,
        remarks: getGradeRemarks(numeric),
        grade_status: getGradeStatus(numeric),
      };
      if (existing) {
        const { error } = await supabase.from('grades').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('grades').insert({
          student_id: studentId,
          subject_id: selectedSubject,
          semester: selectedSemester,
          quarter,
          school_year_id: activeSchoolYearId,
          ...payload,
        });
        if (error) throw error;
      }
      setClassRecordDrafts((prev) => ({
        ...prev,
        [classRecordCellKey(studentId, quarter)]: String(numeric),
      }));
      await loadData();
      setAppMessage({ title: 'Saved', message: `Q${quarter} grade saved from class record.`, variant: 'success' });
    } catch (err: any) {
      setAppMessage({
        title: 'Save failed',
        message: err?.message || 'Could not save class record grade.',
        variant: 'error',
      });
    } finally {
      setClassRecordSavingKey('');
    }
  };

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

  const isBackSubjectForStudent = (studentId: string, subjectId: string) => {
    const st = students.find((s) => s.id === studentId);
    const sub = mySubjects.find((s) => s.id === subjectId);
    if (!st || !sub) return false;
    return (
      yearLevelRank(sub.year_level) > 0 &&
      yearLevelRank(st.grade_level) > 0 &&
      yearLevelRank(sub.year_level) < yearLevelRank(st.grade_level)
    );
  };

  if (loading) {
    return <DashboardLayout title="Grades"><PageSkeletonLoader rows={6} /></DashboardLayout>;
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
        <Button
          type="button"
          variant="secondary"
          disabled={!selectedSubject || submittingForReview}
          onClick={() => void submitCurrentScopeForReview()}
        >
          <Lock className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          {submittingForReview ? 'Submitting...' : 'Submit for review'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!selectedSubject || requestingUnlock}
          onClick={() => void requestUnlockCurrentScope()}
        >
          <Unlock className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          {requestingUnlock ? 'Requesting...' : 'Request unlock'}
        </Button>
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
        {selectedSubject && selectedStudentForEntry && quickEntryLocked && (
          <p className="mb-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
            This student’s grade set for the selected subject/semester is <span className="font-semibold">LOCKED</span>. Use “Request unlock” to make changes.
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
                disabled={quickEntryLocked}
              >
                Numeric
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${entryStatus === 'inc' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                onClick={() => setEntryStatus('inc')}
                disabled={quickEntryLocked}
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
              disabled={quickEntryLocked || entryStatus === 'inc'}
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
              disabled={quickEntryLocked}
            >
              {preset}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <Button type="button" disabled={!selectedSubject || quickEntryLocked} onClick={() => void saveGradeEntry()}>
            Save grade entry
          </Button>
        </div>
      </GlassCard>

      <GlassCard variant="plain" className="mb-6 p-4 sm:p-6">
        <h2 className="mb-2 text-lg font-semibold text-[#800000]">Upload grades (Excel/CSV)</h2>
        <p className="mb-4 text-sm text-gray-600">
          Columns: `student_name`, `semester`, `quarter`, `grade`. Parsed rows are previewed first; nothing is saved
          until you confirm.
        </p>
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
        {uploadParsing && (
          <div className="mt-4">
            <Spinner size="sm" />
          </div>
        )}
        {!uploadParsing && bulkPreviewRows && bulkPreviewSummary && (
          <div className="mt-6 space-y-4 border-t border-gray-100 pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-[#800000]">Preview before saving</h3>
                <p className="mt-1 text-sm text-gray-600">
                  {bulkPreviewSummary.valid} row{bulkPreviewSummary.valid !== 1 ? 's' : ''} will be saved ·{' '}
                  {bulkPreviewSummary.errors} need correction or will be skipped
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className={`text-xs sm:text-sm ${previewFilter === 'all' ? 'ring-2 ring-[#800000]' : ''}`}
                  onClick={() => setPreviewFilter('all')}
                >
                  All ({bulkPreviewSummary.total})
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className={`text-xs sm:text-sm ${previewFilter === 'valid' ? 'ring-2 ring-green-600' : ''}`}
                  onClick={() => setPreviewFilter('valid')}
                >
                  Valid ({bulkPreviewSummary.valid})
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className={`text-xs sm:text-sm ${previewFilter === 'errors' ? 'ring-2 ring-red-600' : ''}`}
                  onClick={() => setPreviewFilter('errors')}
                >
                  Errors ({bulkPreviewSummary.errors})
                </Button>
              </div>
            </div>
            <div className="max-h-[min(24rem,55vh)] overflow-auto rounded-xl border border-gray-200">
              <Table
                variant="light"
                headers={['#', 'Status', 'Student', 'Sem', 'Quarter', 'Grade', 'Remarks', 'Action', 'Previous', 'Issues']}
              >
                {filteredBulkPreviewRows.map((pr) => (
                  <tr
                    key={`${pr.dataRowNumber}-${pr.rawIdentifier}-${pr.studentId ?? ''}-${pr.semester}-${pr.quarter}`}
                    className={
                      pr.ok ? 'border-l-4 border-l-green-500 bg-green-50/35' : 'border-l-4 border-l-red-500 bg-red-50/35'
                    }
                  >
                    <td className="whitespace-nowrap px-2 py-2.5 font-mono text-[11px] sm:px-4 sm:text-xs">{pr.dataRowNumber}</td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-[11px] font-semibold sm:px-4 sm:text-xs">
                      {pr.ok ? <span className="text-green-700">Ready</span> : <span className="text-red-700">Error</span>}
                    </td>
                    <td className="px-2 py-2.5 font-medium sm:px-4">{pr.resolvedName}</td>
                    <td className="px-2 py-2.5 sm:px-4">{pr.semester}</td>
                    <td className="px-2 py-2.5 sm:px-4">{quarterLabel(pr.quarter)}</td>
                    <td className="tabular-nums px-2 py-2.5 font-medium sm:px-4">
                      {pr.numericGrade == null ? '—' : pr.numericGrade}
                    </td>
                    <td className="px-2 py-2.5 text-gray-200/90 sm:px-4">{pr.ok ? pr.remarks : '—'}</td>
                    <td className="px-2 py-2.5 text-[11px] sm:px-4 sm:text-xs">
                      {!pr.ok ? (
                        '—'
                      ) : pr.existingGradeId ? (
                        <span className="rounded bg-amber-500/90 px-1.5 py-0.5 text-white">Replace</span>
                      ) : (
                        <span className="rounded bg-slate-500/80 px-1.5 py-0.5 text-white">New</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-[11px] sm:px-4 sm:text-xs">
                      {!pr.ok ? (
                        '—'
                      ) : pr.existingGradeId ? (
                        <span className="tabular-nums">
                          {pr.existingGradeDisplay === 'INC'
                            ? 'INC'
                            : pr.existingGradeDisplay != null
                              ? String(pr.existingGradeDisplay)
                              : '—'}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="min-w-[8rem] px-2 py-2.5 text-[11px] sm:px-4 sm:text-xs">
                      {pr.errorMessage ? <span className="text-red-700">{pr.errorMessage}</span> : '—'}
                    </td>
                  </tr>
                ))}
              </Table>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                variant="primary"
                disabled={bulkPreviewSummary.valid === 0 || bulkSaving}
                onClick={() => void confirmBulkGradeUpload()}
              >
                {bulkSaving
                  ? 'Saving…'
                  : `Confirm · save ${bulkPreviewSummary.valid} grade${bulkPreviewSummary.valid !== 1 ? 's' : ''}`}
              </Button>
              <Button type="button" variant="secondary" disabled={bulkSaving} onClick={discardBulkGradePreview}>
                Discard preview
              </Button>
            </div>
          </div>
        )}
        {uploadResults && !bulkPreviewRows && (
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

      <GlassCard variant="plain" className="p-4 sm:p-6">
        {!!selectedSubject && (
          <div className="mb-6 overflow-x-auto">
            <h3 className="mb-3 text-lg font-semibold text-[#800000]">Class record view</h3>
            <p className="mb-4 text-sm text-gray-600">
              Spreadsheet-style encoding. Type a grade then click <span className="font-semibold">Save</span> per quarter.
              {` `}If a record is locked, editing is disabled.
            </p>

            <div className="overflow-hidden rounded-2xl border border-gray-200">
              <table className="w-full min-w-max text-left text-xs sm:text-sm">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200">
                    {['Student', 'Q1', 'Q2', 'Q3', 'Q4', 'Final Grade', 'Remarks', 'Completion'].map((h) => (
                      <th
                        key={h}
                        className="whitespace-nowrap px-3 py-3 text-xs font-semibold text-gray-700 sm:px-4 sm:text-sm"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {classRecordRows.map((row) => (
                    <tr key={row.id} className={row.locked ? 'bg-gray-50' : 'hover:bg-gray-50/70'}>
                      <td className="px-3 py-3 font-medium text-gray-900 sm:px-4">
                        <div className="flex items-center gap-2">
                          <span>{row.name}</span>
                          {selectedSubject && isBackSubjectForStudent(row.id, selectedSubject) && (
                            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                              Back Subject
                            </span>
                          )}
                        </div>
                      </td>
                      {[1, 2, 3, 4].map((quarter) => {
                        const current =
                          quarter === 1 ? row.q1 : quarter === 2 ? row.q2 : quarter === 3 ? row.q3 : row.q4;
                        const cellKey = `${row.id}:${quarter}`;
                        const draftValue = getClassRecordInputValue(row.id, quarter, current);
                        const hasExistingNumeric = current !== '—' && current !== 'INC' && current !== '';
                        const hasExistingInc = current === 'INC';
                        const showCurrentLabel = hasExistingInc || hasExistingNumeric;
                        const showCurrentNumericValue =
                          hasExistingNumeric && String(current) !== draftValue && draftValue.trim().length > 0;
                        return (
                          <td key={cellKey} className="px-3 py-3 sm:px-4">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.01}
                                value={draftValue}
                                onChange={(e) => updateClassRecordDraft(row.id, quarter, e.target.value)}
                                placeholder={current === 'INC' ? 'INC' : current === '—' ? '—' : String(current)}
                                disabled={row.locked}
                                className="w-24 rounded-xl border border-gray-300/70 bg-white px-3 py-2 text-sm text-gray-900 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/35 disabled:bg-gray-100 disabled:text-gray-500"
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={classRecordSavingKey === cellKey || row.locked}
                                onClick={() => void saveClassRecordCell(row.id, quarter, current)}
                              >
                                {classRecordSavingKey === cellKey ? 'Saving…' : 'Save'}
                              </Button>
                              </div>
                              {showCurrentLabel && (
                                <div className="text-[11px] text-gray-600">
                                  <span className="font-semibold">Current:</span>{' '}
                                  {hasExistingInc ? (
                                    <span className="font-semibold text-amber-700">INC</span>
                                  ) : showCurrentNumericValue ? (
                                    <span className="font-semibold tabular-nums">{String(current)}</span>
                                  ) : (
                                    <span className="tabular-nums">{String(current)}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-3 py-3 font-semibold text-gray-900 sm:px-4">{row.finalGrade}</td>
                      <td className="px-3 py-3 text-gray-700 sm:px-4">{row.remarks}</td>
                      <td className="px-3 py-3 sm:px-4">
                        <span
                          className={`inline-block h-3 w-3 rounded-full ${
                            row.completionStatus === 'complete'
                              ? 'bg-green-500'
                              : row.completionStatus === 'partial'
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                          }`}
                          title={
                            row.completionStatus === 'complete'
                              ? 'Complete'
                              : row.completionStatus === 'partial'
                                ? 'In progress'
                                : 'No grades yet'
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <p className="mb-3 text-xs text-gray-600 sm:text-sm">
          Row highlight guide: <span className="font-semibold text-green-700">green</span> = excellent (90+),{' '}
          <span className="font-semibold text-red-700">red</span> = failing (&lt;75).
        </p>
        <Table variant="light" headers={['Student', 'Subject', 'Semester', 'Quarter', 'Grade', 'Remarks', 'Status', 'Workflow']}>
          {paginatedGrades.map((grade) => {
            const failing = !isPassing(grade.grade);
            const excellent = Number(grade.grade) >= 90;
            const rowClassName = failing
              ? 'border-l-4 border-red-600 bg-red-200/95 hover:bg-red-200'
              : excellent
                ? 'border-l-4 border-green-600 bg-green-200/90 hover:bg-green-200'
                : 'hover:bg-white/20';
            return (
            <tr key={grade.id} className={rowClassName}>
              <td className={`px-4 py-3 font-semibold ${failing ? 'text-red-950' : excellent ? 'text-green-950' : 'text-gray-800'}`}>
                <div className="flex items-center gap-2">
                  <span>{getStudentName(grade.student_id)}</span>
                  {isBackSubjectForStudent(grade.student_id, grade.subject_id) && (
                    <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                      Back Subject
                    </span>
                  )}
                </div>
              </td>
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
              <td className="px-4 py-3 text-xs font-semibold text-gray-700">
                {grade.is_locked
                  ? 'LOCKED'
                  : grade.unlock_requested
                    ? 'UNLOCK REQUESTED'
                    : grade.workflow_status === 'for_review'
                      ? 'FOR REVIEW'
                      : 'DRAFT'}
              </td>
            </tr>
          )})}
        </Table>
        {filteredGrades.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 border-t border-white/20 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-sm text-gray-100">
              <span>
                Showing{' '}
                <span className="font-semibold">
                  {(gradeTablePage - 1) * gradeTablePageSize + 1}
                </span>{' '}
                -{' '}
                <span className="font-semibold">
                  {Math.min(gradeTablePage * gradeTablePageSize, filteredGrades.length)}
                </span>{' '}
                of <span className="font-semibold">{filteredGrades.length}</span>
              </span>
              <Select
                label=""
                value={`${gradeTablePageSize}`}
                onChange={(e) => setGradeTablePageSize(parseInt(e.target.value, 10))}
                options={[
                  { value: '10', label: '10 / page' },
                  { value: '25', label: '25 / page' },
                  { value: '50', label: '50 / page' },
                ]}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                disabled={gradeTablePage <= 1}
                onClick={() => setGradeTablePage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </Button>
              <span className="px-2 text-sm text-gray-100">
                Page <span className="font-semibold">{gradeTablePage}</span> of{' '}
                <span className="font-semibold">{totalGradePages}</span>
              </span>
              <Button
                type="button"
                disabled={gradeTablePage >= totalGradePages}
                onClick={() => setGradeTablePage((prev) => Math.min(totalGradePages, prev + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
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
