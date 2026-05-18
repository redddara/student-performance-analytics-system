import { useState, useRef, useEffect, useMemo } from 'react';
import { Download, ListFilter, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageIntro } from '../../components/layouts/PageIntro';
import { GlassCard, Button, Select, MessageModal, Table, type AppMessagePayload } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, getGradeRemarks, getGradeStatus } from '../../lib/supabase';
import { isEncodableStudent } from '../../lib/studentStatus';
import {
  buildBulkGradePreview,
  buildExistingGradesLookup,
  quarterLabel,
  type BulkGradePreviewRow,
  type GradeSpreadsheetRow,
  type ExistingGradeLite,
  type EnrolledStudentLite,
} from '../../lib/bulkGradeUploadPreview';
import { getSubjectGradeSemester } from '../../lib/subjectSemester';
import { sortByLabel, sortByName } from '../../lib/sortUtils';

export default function TeacherUploadPage() {
  const { user } = useAuthStore();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [selectedQuarter, setSelectedQuarter] = useState(1);
  const [loading, setLoading] = useState(false);
  const [savingBulk, setSavingBulk] = useState(false);
  const [bulkPreviewRows, setBulkPreviewRows] = useState<BulkGradePreviewRow[] | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'errors'>('all');
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [appMessage, setAppMessage] = useState<AppMessagePayload | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const loadSubjects = async () => {
    const { data } = await supabase.from('subjects').select('*, course:courses(*)').eq('teacher_id', user?.id);
    setMySubjects(data || []);
    if (data?.length) {
      const first = data[0];
      setSelectedSubject(first.id);
      const sem = getSubjectGradeSemester(first);
      if (sem != null) setSelectedSemester(sem);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, [user?.id]);

  const selectedSubjectRecord = useMemo(
    () => mySubjects.find((s) => s.id === selectedSubject) ?? null,
    [mySubjects, selectedSubject]
  );

  const subjectCatalogSemester = useMemo(
    () => getSubjectGradeSemester(selectedSubjectRecord),
    [selectedSubjectRecord]
  );

  const semesterLockedToSubject = Boolean(selectedSubject && subjectCatalogSemester != null);

  useEffect(() => {
    if (subjectCatalogSemester != null) {
      setSelectedSemester(subjectCatalogSemester);
    }
  }, [selectedSubject, subjectCatalogSemester]);

  const applySubjectSelection = (subjectId: string) => {
    setSelectedSubject(subjectId);
    const sub = mySubjects.find((s) => s.id === subjectId);
    const sem = getSubjectGradeSemester(sub);
    if (sem != null) setSelectedSemester(sem);
  };

  useEffect(() => {
    setBulkPreviewRows(null);
    setPreviewFilter('all');
    setResults(null);
  }, [selectedSubject, selectedSemester, selectedQuarter]);

  const previewSummary = useMemo(() => {
    if (!bulkPreviewRows) return null;
    const valid = bulkPreviewRows.filter((r) => r.ok).length;
    const errors = bulkPreviewRows.length - valid;
    return { total: bulkPreviewRows.length, valid, errors };
  }, [bulkPreviewRows]);

  const filteredPreviewRows = useMemo(() => {
    if (!bulkPreviewRows) return [];
    if (previewFilter === 'valid') return bulkPreviewRows.filter((r) => r.ok);
    if (previewFilter === 'errors') return bulkPreviewRows.filter((r) => !r.ok);
    return bulkPreviewRows;
  }, [bulkPreviewRows, previewFilter]);

  const buildPreviewFromSpreadsheet = async (jsonData: GradeSpreadsheetRow[]) => {
    const { data: studentSubjects } = await supabase
      .from('student_subjects')
      .select('*, student:students(*, user:users(*))')
      .eq('subject_id', selectedSubject);

    const enrolledStudents: EnrolledStudentLite[] =
      studentSubjects?.flatMap((ss: { student?: EnrolledStudentLite & { student_status?: string } }) =>
        ss.student && isEncodableStudent(ss.student.student_status) ? [ss.student] : []
      ) ?? [];

    let activeSchoolYearId: string | null = null;
    try {
      const { data: sy, error: syErr } = await supabase
        .from('school_years')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();
      if (!syErr && sy?.id) activeSchoolYearId = sy.id;
    } catch {
      activeSchoolYearId = null;
    }

    let existingQuery = supabase
      .from('grades')
      .select('id, student_id, semester, quarter, school_year_id, grade_status, grade')
      .eq('subject_id', selectedSubject);
    if (activeSchoolYearId) {
      existingQuery = existingQuery.eq('school_year_id', activeSchoolYearId);
    }
    const { data: existingGradeRows } = await existingQuery;

    const existingLookup = buildExistingGradesLookup(
      ((existingGradeRows || []) as ExistingGradeLite[]) ?? [],
      { schoolYearId: activeSchoolYearId }
    );

    const preview = buildBulkGradePreview(jsonData, {
      enrolled: enrolledStudents,
      strategy: 'split_first_last',
      defaultSemester: subjectCatalogSemester ?? selectedSemester,
      defaultQuarter: selectedQuarter,
      existingLookup,
      subject: selectedSubjectRecord,
      schoolYearId: activeSchoolYearId,
    });

    setBulkPreviewRows(preview);
    setPreviewFilter('all');
    setResults(null);
  };

  const processFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSubject) {
      setAppMessage({
        title: 'Select a subject',
        message: 'Choose a subject before uploading a grade file.',
        variant: 'warning',
      });
      return;
    }

    setLoading(true);
    setResults(null);
    setBulkPreviewRows(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<GradeSpreadsheetRow>(sheet);

      if (!jsonData.length) {
        setAppMessage({
          title: 'No rows in file',
          message: 'The spreadsheet appears empty below the header row.',
          variant: 'warning',
        });
        return;
      }

      await buildPreviewFromSpreadsheet(jsonData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not read or process the file.';
      setAppMessage({
        title: 'Upload failed',
        message,
        variant: 'error',
      });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const discardBulkPreview = () => {
    setBulkPreviewRows(null);
    setPreviewFilter('all');
    setResults(null);
  };

  const confirmBulkUpload = async () => {
    if (!bulkPreviewRows?.length || !selectedSubject || savingBulk) return;
    const toSave = bulkPreviewRows.filter((r) => r.ok && r.studentId && r.numericGrade != null);
    if (!toSave.length) return;

    setSavingBulk(true);
    setResults(null);
    try {
      let activeSchoolYearId: string | null = null;
      try {
        const { data: sy, error: syErr } = await supabase
          .from('school_years')
          .select('id')
          .eq('is_active', true)
          .maybeSingle();
        if (!syErr && sy?.id) activeSchoolYearId = sy.id;
      } catch {
        activeSchoolYearId = null;
      }

      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const pr of toSave) {
        try {
          const grade = pr.numericGrade as number;
          const semester = pr.semester;
          const quarter = pr.quarter;

          if (pr.existingGradeId) {
            const { error: updateError } = await supabase
              .from('grades')
              .update({
                grade,
                remarks: getGradeRemarks(grade),
                grade_status: getGradeStatus(grade),
              })
              .eq('id', pr.existingGradeId);
            if (updateError) throw updateError;
          } else {
            const { error: insertError } = await supabase.from('grades').insert({
              student_id: pr.studentId,
              subject_id: selectedSubject,
              semester,
              quarter,
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
      setResults({ success, failed, errors: errors.slice(0, 10) });
    } finally {
      setSavingBulk(false);
    }
  };

  const defaultSubjectId = mySubjects[0]?.id ?? '';
  const hasActiveUploadFilters =
    Boolean(mySubjects.length) &&
    (selectedSemester !== 1 || selectedQuarter !== 1 || (defaultSubjectId && selectedSubject !== defaultSubjectId));

  const clearUploadFilters = () => {
    if (mySubjects[0]) setSelectedSubject(mySubjects[0].id);
    setSelectedSemester(1);
    setSelectedQuarter(1);
  };

  const downloadTemplate = () => {
    const template = [
      { student_name: 'Juan Dela Cruz', semester: 1, quarter: 1, grade: 85 },
      { student_name: 'Juan Dela Cruz', semester: 1, quarter: 2, grade: 88 },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Grades');
    XLSX.writeFile(wb, 'grade_template.xlsx');
  };

  return (
    <DashboardLayout title="Upload Grades">
      <PageIntro
        title="Bulk grade import"
        subtitle="Upload a spreadsheet to add or update grades for students in your subject. You will review every row before anything is saved."
      />
      <GlassCard variant="plain" className="p-4 sm:p-6 mb-6">
        <h2 className="text-xl font-semibold text-[#800000] mb-1">Upload Excel file</h2>
        <p className="mb-4 text-sm leading-relaxed text-gray-600">
          Columns: student_name, semester (1 or 2), quarter (1–4), grade (0–100). Semester follows the selected subject
          (e.g. Thesis 1 → 1st sem only). Use the filter icon to choose subject and quarter. The file is parsed only;
          confirming on the preview step writes grades.
        </p>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-maroon-200 bg-white text-[#800000] shadow-sm transition-colors hover:bg-maroon-50 touch-manipulation"
            aria-expanded={filtersOpen}
            aria-label={filtersOpen ? 'Hide upload filters' : 'Show upload filters'}
            title="Filters"
          >
            <ListFilter className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            {hasActiveUploadFilters && (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#d4af37] ring-2 ring-white" aria-hidden />
            )}
          </button>
          {!filtersOpen && mySubjects.length > 0 && (
            <span className="text-sm text-gray-600">
              <span className="font-semibold text-[#800000]">
                {mySubjects.find((s) => s.id === selectedSubject)?.name || 'Subject'}
              </span>
              {' · '}
              {selectedSemester === 1 ? '1st' : '2nd'} semester · Q{selectedQuarter}
            </span>
          )}
        </div>

        {filtersOpen && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 animate-fade-in">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-[#800000]">Filter upload</h2>
              {hasActiveUploadFilters && (
                <Button type="button" variant="secondary" className="w-full shrink-0 sm:w-auto" onClick={clearUploadFilters}>
                  <RefreshCw className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                  Clear filters
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select
                label="Select Subject"
                value={selectedSubject}
                onChange={(e) => applySubjectSelection(e.target.value)}
                options={sortByLabel(
                  sortByName(mySubjects).map((s) => ({ value: s.id, label: `${s.name} - ${s.course?.name || ''}` }))
                )}
              />
              <Select
                label={semesterLockedToSubject ? 'Semester (from subject)' : 'Semester'}
                value={`${selectedSemester}`}
                onChange={(e) => setSelectedSemester(parseInt(e.target.value, 10))}
                disabled={semesterLockedToSubject}
                options={[
                  { value: '1', label: '1st Semester' },
                  { value: '2', label: '2nd Semester' },
                ]}
              />
              <Select
                label="Quarter"
                value={`${selectedQuarter}`}
                onChange={(e) => setSelectedQuarter(parseInt(e.target.value, 10))}
                options={[
                  { value: '1', label: 'Prelim' },
                  { value: '2', label: 'Midterm' },
                  { value: '3', label: 'Pre-Finals' },
                  { value: '4', label: 'Finals' },
                ]}
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={processFile}
            className="w-full min-w-0 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[#800000] file:text-white hover:file:bg-[#600000]"
          />
          <Button variant="primary" className="w-full shrink-0 sm:w-auto" onClick={downloadTemplate}>
            <Download className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            Download Template
          </Button>
        </div>
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

      {loading && (
        <div className="space-y-4 py-8" aria-busy="true" aria-label="Reading spreadsheet">
          <div className="h-44 animate-pulse rounded-2xl border border-gray-200/75 bg-gray-100/95" />
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="h-24 animate-pulse rounded-xl bg-gray-200/65" />
            <div className="h-24 animate-pulse rounded-xl bg-gray-200/65" />
          </div>
        </div>
      )}

      {bulkPreviewRows && previewSummary && (
        <GlassCard variant="plain" className="p-4 sm:p-6 mb-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[#800000]">Preview before saving</h3>
              <p className="mt-1 text-sm text-gray-600">
                {previewSummary.valid} row{previewSummary.valid !== 1 ? 's' : ''} ready to save,{' '}
                {previewSummary.errors} row{previewSummary.errors !== 1 ? 's' : ''}{' '}
                {previewSummary.errors ? 'skipped (fix and re-upload, or proceed with valid rows only)' : 'skipped'}.
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Row numbers start at 1 on the first data row beneath your header. Current filters:{' '}
                {mySubjects.find((s) => s.id === selectedSubject)?.name || 'Subject'} · Sem {selectedSemester} ·{' '}
                {quarterLabel(selectedQuarter)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                className={previewFilter === 'all' ? 'ring-2 ring-[#800000]' : ''}
                onClick={() => setPreviewFilter('all')}
              >
                All ({previewSummary.total})
              </Button>
              <Button
                type="button"
                variant="secondary"
                className={previewFilter === 'valid' ? 'ring-2 ring-green-600' : ''}
                onClick={() => setPreviewFilter('valid')}
              >
                Valid ({previewSummary.valid})
              </Button>
              <Button
                type="button"
                variant="secondary"
                className={previewFilter === 'errors' ? 'ring-2 ring-red-600' : ''}
                onClick={() => setPreviewFilter('errors')}
              >
                Errors ({previewSummary.errors})
              </Button>
            </div>
          </div>

          <div className="max-h-[min(28rem,60vh)] overflow-auto rounded-xl border border-gray-200 shadow-inner">
            <Table
              headers={[
                '#',
                'Status',
                'Student',
                'Sem',
                'Quarter',
                'Grade',
                'Remarks',
                'Action',
                'Previous',
                'Issues',
              ]}
            >
              {filteredPreviewRows.map((pr) => (
                <tr
                  key={`${pr.dataRowNumber}-${pr.rawIdentifier}-${pr.studentId ?? ''}-${pr.semester}-${pr.quarter}`}
                  className={
                    pr.ok ? 'border-l-4 border-l-green-500 bg-green-50/40' : 'border-l-4 border-l-red-500 bg-red-50/35'
                  }
                >
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-gray-700">{pr.dataRowNumber}</td>
                  <td className="px-4 py-2.5 text-sm font-semibold">
                    {pr.ok ? <span className="text-green-700">Ready</span> : <span className="text-red-700">Error</span>}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{pr.resolvedName}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-700">{pr.semester}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-700">{quarterLabel(pr.quarter)}</td>
                  <td className="px-4 py-2.5 tabular-nums font-medium">{pr.numericGrade == null ? '—' : pr.numericGrade}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">{pr.ok ? pr.remarks : '—'}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-700">
                    {!pr.ok ? (
                      <span className="text-gray-400">—</span>
                    ) : pr.existingGradeId ? (
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 font-medium text-amber-900">
                        Replace existing
                      </span>
                    ) : (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-800">Insert new</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">
                    {!pr.ok ? (
                      <span className="text-gray-400">—</span>
                    ) : pr.existingGradeId ? (
                      <span className="tabular-nums">
                        {pr.existingGradeDisplay === 'INC'
                          ? 'INC'
                          : pr.existingGradeDisplay != null
                            ? `${pr.existingGradeDisplay}`
                            : '—'}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="min-w-[10rem] px-4 py-2.5 text-sm text-gray-700">
                    {pr.errorMessage ? <span className="text-red-800">{pr.errorMessage}</span> : '—'}
                  </td>
                </tr>
              ))}
            </Table>
          </div>

          {filteredPreviewRows.length === 0 && (
            <p className="mt-4 text-center text-sm text-gray-500">
              Nothing to show — change the preview filter tabs above.
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              variant="primary"
              disabled={previewSummary.valid === 0 || savingBulk}
              onClick={() => void confirmBulkUpload()}
            >
              {savingBulk ? 'Saving…' : `Confirm & save ${previewSummary.valid} grade${previewSummary.valid !== 1 ? 's' : ''}`}
            </Button>
            <Button type="button" variant="secondary" disabled={savingBulk} onClick={discardBulkPreview}>
              Discard preview & choose another file
            </Button>
          </div>
          {previewSummary.errors > 0 && previewSummary.valid > 0 && (
            <p className="mt-3 text-xs text-amber-800">
              Rows with errors are not saved. Fix the spreadsheet and upload again if you need those corrected.
            </p>
          )}
          {previewSummary.errors > 0 && previewSummary.valid === 0 && (
            <p className="mt-3 text-sm text-red-700">Nothing can be saved until at least one row is valid.</p>
          )}
        </GlassCard>
      )}

      {results && (
        <GlassCard variant="plain" className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-[#800000] mb-4">Upload Results</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center p-4 rounded-xl bg-green-50 border border-green-200">
              <p className="text-2xl font-bold text-green-600">{results.success}</p>
              <p className="text-sm text-green-600">Successfully Updated</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-red-50 border border-red-200">
              <p className="text-2xl font-bold text-red-600">{results.failed}</p>
              <p className="text-sm text-red-600">Failed</p>
            </div>
          </div>

          {results.errors.length > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-yellow-50 border border-yellow-200">
              <p className="font-semibold text-yellow-800 mb-2">Errors (showing first 10):</p>
              <ul className="text-sm text-yellow-700 list-disc list-inside">
                {results.errors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}
        </GlassCard>
      )}
    </DashboardLayout>
  );
}