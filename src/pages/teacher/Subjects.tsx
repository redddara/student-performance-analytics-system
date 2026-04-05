import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, ListFilter, Pencil, RefreshCw, Search, XCircle } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageIntro } from '../../components/layouts/PageIntro';
import {
  GlassCard,
  Button,
  Input,
  Select,
  Table,
  Modal,
  Spinner,
  MessageModal,
  type AppMessagePayload,
} from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, getGradeRemarks } from '../../lib/supabase';
import { SCHOOL_SECTION_SELECT_OPTIONS, normalizeSchoolSection } from '../../constants/schoolSections';

const QUARTER_LABELS: Record<number, string> = {
  1: 'Prelim',
  2: 'Midterm',
  3: 'Pre-Finals',
  4: 'Finals',
};

export default function TeacherSubjectsPage() {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [subjectId] = useState(searchParams.get('id'));
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [gradeForm, setGradeForm] = useState({ semester: 1, quarter: 1, grade: '' });
  const [appMessage, setAppMessage] = useState<AppMessagePayload | null>(null);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [entrySemester, setEntrySemester] = useState(1);
  const [entryQuarter, setEntryQuarter] = useState(1);
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showFullMatrix, setShowFullMatrix] = useState(false);

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    if (subjectId) {
      loadSubjectDetails(subjectId);
    }
  }, [subjectId]);

  const loadSubjects = async () => {
    const { data } = await supabase
      .from('subjects')
      .select('*, course:courses(*)')
      .eq('teacher_id', user?.id);
    setMySubjects(data || []);
    if (data && data.length > 0 && !subjectId) {
      setSelectedSubject(data[0]);
      loadSubjectDetails(data[0].id);
    }
    setLoading(false);
  };

  const loadSubjectDetails = async (sid: string) => {
    const subject = mySubjects.find((s) => s.id === sid) || (await supabase.from('subjects').select('*, course:courses(*)').eq('id', sid).single());
    setSelectedSubject(subject.data || subject);

    const { data: studentSubjects } = await supabase
      .from('student_subjects')
      .select('*, student:students(*, user:users(*), course:courses(*))')
      .eq('subject_id', sid);

    setEnrolledStudents(studentSubjects || []);

    const { data: gradesData } = await supabase.from('grades').select('*').eq('subject_id', sid);
    setGrades(gradesData || []);
  };

  useEffect(() => {
    const drafts: Record<string, string> = {};
    enrolledStudents.forEach((es) => {
      const id = es.student?.id;
      if (!id) return;
      const g = grades.find(
        (gr) => gr.student_id === id && gr.semester === entrySemester && gr.quarter === entryQuarter
      );
      drafts[id] = g?.grade != null ? String(g.grade) : '';
    });
    setGradeDrafts(drafts);
  }, [enrolledStudents, grades, entrySemester, entryQuarter, selectedSubject?.id]);

  const filteredEnrolled = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return enrolledStudents.filter((es) => {
      const st = es.student;
      const name = `${st?.first_name || ''} ${st?.last_name || ''}`.trim().toLowerCase();
      if (q && !name.includes(q)) return false;
      if (filterSection && normalizeSchoolSection(st?.section) !== filterSection) return false;
      return true;
    });
  }, [enrolledStudents, filterSearch, filterSection]);

  const hasActiveFilters = Boolean(filterSearch.trim()) || Boolean(filterSection);

  const clearFilters = () => {
    setFilterSearch('');
    setFilterSection('');
  };

  const saveGradeForStudent = async (studentId: string) => {
    if (!selectedSubject?.id) return;
    const raw = gradeDrafts[studentId]?.trim();
    if (raw === '') {
      setAppMessage({
        title: 'Enter a grade',
        message: 'Type a score from 0–100 before saving.',
        variant: 'warning',
      });
      return;
    }
    const gradeValue = parseFloat(raw);
    if (Number.isNaN(gradeValue) || gradeValue < 0 || gradeValue > 100) {
      setAppMessage({
        title: 'Invalid grade',
        message: 'Use a number between 0 and 100.',
        variant: 'warning',
      });
      return;
    }

    setSavingId(studentId);
    try {
      const existingGrade = grades.find(
        (g) => g.student_id === studentId && g.semester === entrySemester && g.quarter === entryQuarter
      );

      if (existingGrade) {
        const { error } = await supabase
          .from('grades')
          .update({
            grade: gradeValue,
            remarks: getGradeRemarks(gradeValue),
          })
          .eq('id', existingGrade.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('grades').insert({
          student_id: studentId,
          subject_id: selectedSubject.id,
          semester: entrySemester,
          quarter: entryQuarter,
          grade: gradeValue,
          remarks: getGradeRemarks(gradeValue),
        });
        if (error) throw error;
      }

      await loadSubjectDetails(selectedSubject.id);
      setAppMessage({
        title: 'Grade saved',
        message: `${QUARTER_LABELS[entryQuarter] || 'Q' + entryQuarter} • ${entrySemester === 1 ? '1st' : '2nd'} sem — recorded.`,
        variant: 'success',
      });
    } catch (err: any) {
      setAppMessage({
        title: 'Could not save',
        message: err.message || 'Try again.',
        variant: 'error',
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveGradeModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const gradeValue = parseFloat(gradeForm.grade);
    if (Number.isNaN(gradeValue) || gradeValue < 0 || gradeValue > 100) {
      setAppMessage({
        title: 'Invalid grade',
        message: 'Enter a number between 0 and 100.',
        variant: 'warning',
      });
      return;
    }

    const existingGrade = grades.find(
      (g) =>
        g.student_id === selectedStudent?.id &&
        g.semester === gradeForm.semester &&
        g.quarter === gradeForm.quarter
    );

    if (existingGrade) {
      await supabase
        .from('grades')
        .update({
          grade: gradeValue,
          remarks: getGradeRemarks(gradeValue),
        })
        .eq('id', existingGrade.id);
    } else {
      await supabase.from('grades').insert({
        student_id: selectedStudent.id,
        subject_id: selectedSubject.id,
        semester: gradeForm.semester,
        quarter: gradeForm.quarter,
        grade: gradeValue,
        remarks: getGradeRemarks(gradeValue),
      });
    }

    setShowGradeModal(false);
    await loadSubjectDetails(selectedSubject.id);
    setAppMessage({ title: 'Grade saved', message: 'The grade has been recorded for this student.', variant: 'success' });
  };

  const getStudentGrade = (studentId: string, semester: number, quarter: number) => {
    const grade = grades.find((g) => g.student_id === studentId && g.semester === semester && g.quarter === quarter);
    return grade?.grade != null ? `${grade.grade} (${getGradeRemarks(grade.grade)})` : '—';
  };

  if (loading) {
    return <DashboardLayout title="My Subjects"><Spinner size="lg" /></DashboardLayout>;
  }

  const periodLabel = `${entrySemester === 1 ? '1st' : '2nd'} sem · ${QUARTER_LABELS[entryQuarter] || 'Q' + entryQuarter}`;

  return (
    <DashboardLayout title="My Subjects">
      <PageIntro
        title="Subjects you teach"
        subtitle="Choose a subject, pick the semester and quarter, then type grades and save per student—no need to open a form for every score. Use filters to find students quickly."
      />

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <Select
          label="Subject"
          value={`${subjectId || selectedSubject?.id || ''}`}
          onChange={(e) => {
            window.location.href = `/teacher/subjects?id=${e.target.value}`;
          }}
          options={mySubjects.map((s) => ({ value: `${s.id}`, label: `${s.name} — ${s.course?.name || 'Course'}` }))}
        />
      </div>

      {selectedSubject && (
        <>
          <GlassCard className="p-4 sm:p-6 mb-6">
            <h2 className="text-xl font-semibold text-[#800000] mb-2">{selectedSubject.name}</h2>
            <p className="text-gray-600 leading-relaxed">
              {selectedSubject.course?.name} · {selectedSubject.year_level} · {selectedSubject.semester}
            </p>
            <p className="text-sm text-gray-500 mt-2">Enrolled: {enrolledStudents.length} student(s)</p>
          </GlassCard>

          <div className="mb-5 w-full max-w-2xl">
            <label htmlFor="grade-student-search" className="sr-only">
              Search enrolled students
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-maroon-700/75" aria-hidden>
                <Search className="h-5 w-5 shrink-0" strokeWidth={2} />
              </span>
              <input
                id="grade-student-search"
                type="search"
                autoComplete="off"
                placeholder="Search student by name…"
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
                Showing <span className="font-semibold text-[#800000]">{filteredEnrolled.length}</span> /{' '}
                {enrolledStudents.length} enrolled
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
              <Select
                label="Section"
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
                options={[{ value: '', label: 'All sections' }, ...SCHOOL_SECTION_SELECT_OPTIONS]}
              />
            </div>
          )}

          <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-[#800000] mb-1">Quick grade entry</h2>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              Choose the grading period below. Each row shows one student—enter the score and press Save (or Enter).
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Select
                label="Semester"
                value={`${entrySemester}`}
                onChange={(e) => setEntrySemester(parseInt(e.target.value, 10))}
                options={[
                  { value: '1', label: '1st Semester' },
                  { value: '2', label: '2nd Semester' },
                ]}
              />
              <Select
                label="Quarter"
                value={`${entryQuarter}`}
                onChange={(e) => setEntryQuarter(parseInt(e.target.value, 10))}
                options={[
                  { value: '1', label: 'Prelim' },
                  { value: '2', label: 'Midterm' },
                  { value: '3', label: 'Pre-Finals' },
                  { value: '4', label: 'Finals' },
                ]}
              />
            </div>
          </div>

          <GlassCard className="p-4 sm:p-6 mb-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-semibold text-[#800000]">Entry table</h3>
              <span className="text-sm font-medium text-gray-600">Period: {periodLabel}</span>
            </div>
            {filteredEnrolled.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                {enrolledStudents.length === 0 ? 'No students enrolled' : 'No students match your search or filters.'}
              </p>
            ) : (
              <div className="-mx-1 overflow-x-auto sm:mx-0">
                <table className="w-full min-w-[320px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gold-400/35 bg-black/20">
                      <th className="px-3 py-3 font-semibold text-gold-200/95">Student</th>
                      <th className="px-3 py-3 font-semibold text-gold-200/95 w-24">Section</th>
                      <th className="px-3 py-3 font-semibold text-gold-200/95 min-w-[7rem]">Grade (0–100)</th>
                      <th className="px-3 py-3 font-semibold text-gold-200/95 w-28">Save</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gold-400/15">
                    {filteredEnrolled.map((es) => {
                      const sid = es.student?.id;
                      if (!sid) return null;
                      return (
                        <tr key={es.id} className="hover:bg-white/10">
                          <td className="px-3 py-3 font-medium text-gray-800">
                            {es.student?.first_name} {es.student?.last_name}
                          </td>
                          <td className="px-3 py-3 text-gray-600">{es.student?.section || '—'}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.01}
                              inputMode="decimal"
                              aria-label={`Grade for ${es.student?.first_name} ${es.student?.last_name}`}
                              className="w-full max-w-[7rem] rounded-xl border border-gray-300/80 bg-white px-3 py-2 text-base text-gray-900 shadow-sm focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/30"
                              value={gradeDrafts[sid] ?? ''}
                              onChange={(e) => setGradeDrafts((d) => ({ ...d, [sid]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void saveGradeForStudent(sid);
                                }
                              }}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="primary"
                              className="w-full min-h-[40px] sm:min-h-0"
                              disabled={savingId === sid}
                              onClick={() => void saveGradeForStudent(sid)}
                            >
                              {savingId === sid ? '…' : 'Save'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>

          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowFullMatrix((v) => !v)}
              className="text-sm font-semibold text-[#800000] underline-offset-2 hover:underline"
            >
              {showFullMatrix ? 'Hide full grade sheet' : 'Show full grade sheet (all quarters)'}
            </button>
          </div>

          {showFullMatrix && (
            <GlassCard className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-[#800000] mb-4">All quarters overview</h3>
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                Read-only summary. Use <strong>Quick grade entry</strong> above for fast input, or Edit on a cell to change a specific slot in a dialog.
              </p>
              <Table
                headers={[
                  'Student',
                  'Section',
                  '1st Prelim',
                  '1st Mid',
                  '1st Pre-Fin',
                  '1st Fin',
                  '2nd Prelim',
                  '2nd Mid',
                  '2nd Pre-Fin',
                  '2nd Fin',
                  'Edit',
                ]}
              >
                {enrolledStudents.map((es) => (
                  <tr key={es.id} className="hover:bg-white/20">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {es.student?.first_name} {es.student?.last_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{es.student?.section || '—'}</td>
                    {[1, 2].map((sem) =>
                      [1, 2, 3, 4].map((q) => {
                        const text = getStudentGrade(es.student?.id, sem, q);
                        return (
                          <td key={`${sem}-${q}`} className="px-4 py-3 text-gray-600 text-xs sm:text-sm whitespace-nowrap">
                            {text}
                          </td>
                        );
                      })
                    )}
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedStudent(es.student);
                          setGradeForm({ semester: entrySemester, quarter: entryQuarter, grade: gradeDrafts[es.student?.id] || '' });
                          setShowGradeModal(true);
                        }}
                      >
                        <Pencil className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </Table>
              {enrolledStudents.length === 0 && (
                <p className="text-center text-gray-500 py-8">No students enrolled</p>
              )}
            </GlassCard>
          )}
        </>
      )}

      <Modal
        isOpen={showGradeModal}
        onClose={() => setShowGradeModal(false)}
        title={`Grade: ${selectedStudent?.first_name} ${selectedStudent?.last_name}`}
      >
        <form onSubmit={handleSaveGradeModal} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Semester"
              value={`${gradeForm.semester}`}
              onChange={(e) => setGradeForm({ ...gradeForm, semester: parseInt(e.target.value, 10) })}
              options={[
                { value: '1', label: '1st Semester' },
                { value: '2', label: '2nd Semester' },
              ]}
            />
            <Select
              label="Quarter"
              value={`${gradeForm.quarter}`}
              onChange={(e) => setGradeForm({ ...gradeForm, quarter: parseInt(e.target.value, 10) })}
              options={[
                { value: '1', label: 'Prelim' },
                { value: '2', label: 'Midterm' },
                { value: '3', label: 'Pre-Finals' },
                { value: '4', label: 'Finals' },
              ]}
            />
          </div>
          <Input
            label="Grade (0–100)"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={gradeForm.grade}
            onChange={(e) => setGradeForm({ ...gradeForm, grade: e.target.value })}
            required
            placeholder="e.g. 88.5"
          />
          <div className="flex gap-4">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowGradeModal(false)}>
              <XCircle className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              <CheckCircle2 className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              Save grade
            </Button>
          </div>
        </form>
      </Modal>

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
