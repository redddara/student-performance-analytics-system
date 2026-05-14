import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Lock, LockOpen, Pencil } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageIntro } from '../../components/layouts/PageIntro';
import { Button, GlassCard, Modal, Select, Table, PageSkeletonLoader } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, getGradeRemarks, getGradeStatus } from '../../lib/supabase';
import { useSupabaseLiveReload } from '../../lib/useSupabaseLiveReload';

type FinalAverageRow = {
  key: string;
  student_id: string;
  subject_id: string;
  semester: number;
  student_name: string;
  course_name: string;
  section: string;
  subject_name: string;
  quarter_count: number;
  final_average: number | null;
  status: 'passed' | 'failed' | 'inc';
  grade_ids: string[];
};

export default function AdminGradesPage() {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [schoolYears, setSchoolYears] = useState<any[]>([]);
  const [activeSchoolYearId, setActiveSchoolYearId] = useState<string | null>(null);
  const [schoolYearFilter, setSchoolYearFilter] = useState<'active' | 'all' | string>('active');
  const [q, setQ] = useState('');
  const [semester, setSemester] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [section, setSection] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  const [editRow, setEditRow] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState<'passed' | 'failed' | 'inc'>('passed');
  const [editGrade, setEditGrade] = useState('');
  const [actionLoadingKey, setActionLoadingKey] = useState('');
  const [activeSchoolYearName, setActiveSchoolYearName] = useState('');

  useEffect(() => {
    const subject = searchParams.get('subject') || '';
    const sem = searchParams.get('semester') || '';
    if (subject) setSubjectId(subject);
    if (sem) setSemester(sem);
  }, [searchParams]);

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) setLoading(true);
    let activeSy: { id?: string; name?: string } | null = null;
    try {
      try {
        const listRes = await supabase
          .from('school_years')
          .select('id,name,is_active,created_at')
          .order('created_at', { ascending: false });
        if (listRes.error) throw listRes.error;
        const list = (listRes.data || []) as any[];
        setSchoolYears(list);
        const foundActive = list.find((sy) => Boolean(sy.is_active)) || null;

        activeSy = foundActive ? { id: foundActive.id, name: foundActive.name } : null;
        setActiveSchoolYearId(foundActive?.id ?? null);
        setActiveSchoolYearName(activeSy?.name || 'None active');
      } catch {
        // Backward-compat: if migration not applied yet, keep admin grades working.
        activeSy = null;
        setActiveSchoolYearName('All years');
      }

      const effectiveSchoolYearId =
        schoolYearFilter === 'all'
          ? null
          : schoolYearFilter === 'active'
            ? activeSy?.id || null
            : schoolYearFilter || null;

      const [gradesRes, studentsRes, subjectsRes, coursesRes] = await Promise.all([
        (async () => {
          let query = supabase.from('grades').select('*').order('created_at', { ascending: false });
          // Active-year view: include legacy rows missing school_year_id (bulk upload used to omit it).
          if (effectiveSchoolYearId) {
            if (schoolYearFilter === 'active') {
              query = query.or(
                `school_year_id.eq.${effectiveSchoolYearId},school_year_id.is.null`
              );
            } else {
              query = query.eq('school_year_id', effectiveSchoolYearId);
            }
          }
          return query;
        })(),
        supabase.from('students').select('id,first_name,last_name,section,grade_level,course_id'),
        supabase.from('subjects').select('id,name,course_id'),
        supabase.from('courses').select('id,name'),
      ]);
      setGrades(gradesRes.data || []);
      setStudents(studentsRes.data || []);
      setSubjects(subjectsRes.data || []);
      setCourses(coursesRes.data || []);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [schoolYearFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useSupabaseLiveReload(
    useCallback(() => loadData({ silent: true }), [loadData]),
    user?.id ? `live:admin-grades:${user.id}` : null,
    ['grades', 'students', 'subjects', 'courses', 'school_years', 'student_subjects']
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return grades.filter((g) => {
      const st = students.find((s) => s.id === g.student_id);
      const sb = subjects.find((s) => s.id === g.subject_id);
      if (semester && String(g.semester) !== semester) return false;
      if (subjectId && g.subject_id !== subjectId) return false;
      if (courseId && st?.course_id !== courseId) return false;
      if (section && String(st?.section || '').toLowerCase() !== section.toLowerCase()) return false;
      if (yearLevel && String(st?.grade_level || '') !== yearLevel) return false;
      if (!term) return true;
      const name = `${st?.first_name || ''} ${st?.last_name || ''}`.trim().toLowerCase();
      const courseName = String(courses.find((c) => c.id === st?.course_id)?.name || '').toLowerCase();
      return (
        name.includes(term) ||
        String(sb?.name || '').toLowerCase().includes(term) ||
        courseName.includes(term) ||
        String(st?.section || '').toLowerCase().includes(term)
      );
    });
  }, [grades, q, semester, subjectId, courseId, section, yearLevel, students, subjects, courses]);

  const finalRows = useMemo<FinalAverageRow[]>(() => {
    const grouped = new Map<string, any[]>();
    for (const g of filtered) {
      const key = `${g.student_id}__${g.subject_id}__${g.semester}`;
      const arr = grouped.get(key) || [];
      arr.push(g);
      grouped.set(key, arr);
    }

    const rows: FinalAverageRow[] = [];
    for (const [key, list] of grouped.entries()) {
      const first = list[0];
      const st = students.find((s) => s.id === first.student_id);
      const sb = subjects.find((s) => s.id === first.subject_id);
      const cr = courses.find((c) => c.id === st?.course_id);
      const hasInc = list.some((g) => g.grade_status === 'inc');
      const numeric = list.filter((g) => g.grade_status !== 'inc').map((g) => Number(g.grade));
      const avg =
        numeric.length > 0
          ? Math.round((numeric.reduce((sum, n) => sum + n, 0) / numeric.length) * 100) / 100
          : null;
      const status: 'passed' | 'failed' | 'inc' = hasInc ? 'inc' : getGradeStatus(avg ?? 0);
      rows.push({
        key,
        student_id: first.student_id,
        subject_id: first.subject_id,
        semester: first.semester,
        student_name: `${st?.first_name || ''} ${st?.last_name || ''}`.trim(),
        course_name: cr?.name || '',
        section: st?.section || '',
        subject_name: sb?.name || '',
        quarter_count: list.length,
        final_average: avg,
        status,
        grade_ids: list.map((g) => g.id),
      });
    }

    return rows.sort((a, b) =>
      `${a.student_name}`.toLowerCase().localeCompare(`${b.student_name}`.toLowerCase())
    );
  }, [filtered, students, subjects, courses]);

  const exportCsv = () => {
    const rows = finalRows.map((r) => {
      return {
        student: r.student_name,
        course: r.course_name,
        section: r.section,
        subject: r.subject_name,
        semester: r.semester,
        quarters_included: r.quarter_count,
        final_average: r.status === 'inc' ? 'INC' : r.final_average,
        status: r.status.toUpperCase(),
      };
    });
    const header = Object.keys(rows[0] || {
      student: '',
      course: '',
      section: '',
      subject: '',
      semester: '',
      quarters_included: '',
      final_average: '',
      status: '',
    });
    const csv = [header.join(','), ...rows.map((r) => header.map((k) => JSON.stringify((r as any)[k] ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const subjectLabel = subjectId ? (subjects.find((s) => s.id === subjectId)?.name || 'subject') : 'all-subjects';
    const courseLabel = courseId ? (courses.find((c) => c.id === courseId)?.name || 'course') : 'all-courses';
    const safe = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    a.download = `${safe(subjectLabel)}-${safe(courseLabel)}-${safe(section || 'all-sections')}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveEdit = async () => {
    if (!editRow) return;
    const n = Number(editGrade);
    if (editStatus !== 'inc' && (Number.isNaN(n) || n < 0 || n > 100)) return;
    if (editStatus === 'passed' && n < 75) return;
    if (editStatus === 'failed' && n >= 75) return;
    const payload =
      editStatus === 'inc'
        ? { grade_status: 'inc', grade: 0, remarks: 'INC' }
        : { grade_status: editStatus, grade: n, remarks: getGradeRemarks(n) };

    await supabase
      .from('grades')
      .update(payload)
      .in('id', editRow.grade_ids || []);
    setEditRow(null);
    await loadData();
  };

  const approveAndLock = async (row: FinalAverageRow) => {
    if (!row.grade_ids.length) return;
    setActionLoadingKey(`${row.key}:lock`);
    await supabase
      .from('grades')
      .update({
        workflow_status: 'approved',
        is_locked: true,
        locked_at: new Date().toISOString(),
        unlock_requested: false,
        unlock_reason: null,
        unlock_requested_at: null,
      })
      .in('id', row.grade_ids);
    setActionLoadingKey('');
    await loadData();
  };

  const approveUnlock = async (row: FinalAverageRow) => {
    if (!row.grade_ids.length) return;
    setActionLoadingKey(`${row.key}:unlock`);
    try {
      await supabase
        .from('grades')
        .update({
          workflow_status: 'reopened',
          is_locked: false,
          locked_at: null,
          locked_by: null,
          unlock_requested: false,
          unlock_reason: null,
          unlock_requested_at: null,
          unlock_requested_by: null,
        })
        .in('id', row.grade_ids);
      await loadData();
    } finally {
      setActionLoadingKey('');
    }
  };

  if (loading) return <DashboardLayout title="Grades"><PageSkeletonLoader rows={4} /></DashboardLayout>;

  return (
    <DashboardLayout title="Grades">
      <PageIntro title="Final subject averages" subtitle="Admin view shows one final average per student per subject (all quarters combined)." />
      <p className="mb-3 text-sm text-gray-600">
        Active School Year: <span className="font-semibold text-[#800000]">{activeSchoolYearName}</span>
      </p>
      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <input
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5"
          placeholder="Search student, subject, course, or section..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select
          label="Viewing school year"
          value={schoolYearFilter}
          onChange={(e) => setSchoolYearFilter(e.target.value as any)}
          options={[
            { value: 'active', label: activeSchoolYearId ? 'Active school year' : 'Active school year (none)' },
            { value: 'all', label: 'All school years' },
            ...(schoolYears || []).map((sy) => ({ value: sy.id, label: sy.name })),
          ]}
        />
        <Select
          label="Semester"
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
          options={[{ value: '', label: 'All' }, { value: '1', label: '1st' }, { value: '2', label: '2nd' }]}
        />
        <Select
          label="Subject"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          options={[{ value: '', label: 'All subjects' }, ...subjects.map((s) => ({ value: s.id, label: s.name }))]
          }
        />
        <Select
          label="Course"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          options={[{ value: '', label: 'All courses' }, ...courses.map((c) => ({ value: c.id, label: c.name }))]
          }
        />
        <Select
          label="Year level"
          value={yearLevel}
          onChange={(e) => setYearLevel(e.target.value)}
          options={[
            { value: '', label: 'All years' },
            { value: '1st', label: '1st Year' },
            { value: '2nd', label: '2nd Year' },
            { value: '3rd', label: '3rd Year' },
            { value: '4th', label: '4th Year' },
          ]}
        />
        <input
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5"
          placeholder="Section (e.g. 3N1)"
          value={section}
          onChange={(e) => setSection(e.target.value)}
        />
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Showing <span className="font-semibold text-[#800000]">{finalRows.length}</span> final average record{finalRows.length !== 1 ? 's' : ''} (sorted by student).
        </p>
        <Button type="button" onClick={exportCsv}>
          <Download className="h-5 w-5 shrink-0" />
          Export Filtered CSV
        </Button>
      </div>
      <GlassCard className="p-4 sm:p-6">
        <Table headers={['Student', 'Course', 'Section', 'Subject', 'Sem', 'Quarters', 'Final Average', 'Status', 'Workflow', 'Actions']}>
          {finalRows.map((row) => {
            const relatedGrades = grades.filter((g) => row.grade_ids.includes(g.id));
            const anyLocked = relatedGrades.some((g) => Boolean(g.is_locked));
            const anyUnlockRequested = relatedGrades.some((g) => Boolean(g.unlock_requested));
            const hasForReview = relatedGrades.some((g) => g.workflow_status === 'for_review');
            const workflowLabel = anyLocked ? 'LOCKED' : anyUnlockRequested ? 'UNLOCK REQUESTED' : hasForReview ? 'FOR REVIEW' : 'DRAFT';
            return (
              <tr key={row.key}>
                <td className="px-4 py-3">{row.student_name || '—'}</td>
                <td className="px-4 py-3">{row.course_name || '—'}</td>
                <td className="px-4 py-3">{row.section || '—'}</td>
                <td className="px-4 py-3">{row.subject_name || '—'}</td>
                <td className="px-4 py-3">{row.semester}</td>
                <td className="px-4 py-3">{row.quarter_count}</td>
                <td className="px-4 py-3">{row.status === 'inc' ? 'INC' : row.final_average ?? '—'}</td>
                <td className="px-4 py-3">{row.status.toUpperCase()}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-semibold">{workflowLabel}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="rounded-lg p-2 text-[#800000] hover:bg-maroon-50 disabled:opacity-50"
                      disabled={anyLocked}
                      onClick={() => {
                        setEditRow(row);
                        setEditStatus(row.status);
                        setEditGrade(String(row.final_average ?? ''));
                      }}
                      title={anyLocked ? 'Locked grades cannot be edited.' : 'Edit final average'}
                    >
                      <Pencil className="h-[1.1rem] w-[1.1rem] shrink-0" />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-2 text-green-700 hover:bg-green-50 disabled:opacity-50"
                      disabled={anyLocked || actionLoadingKey === `${row.key}:lock`}
                      onClick={() => void approveAndLock(row)}
                      title="Approve and lock grades"
                    >
                      <Lock className="h-[1.1rem] w-[1.1rem] shrink-0" />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-2 text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                      disabled={!anyLocked || actionLoadingKey === `${row.key}:unlock`}
                      onClick={() => void approveUnlock(row)}
                      title={anyLocked ? 'Unlock and reopen for editing' : 'Already unlocked'}
                    >
                      <LockOpen className="h-[1.1rem] w-[1.1rem] shrink-0" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      </GlassCard>

      <Modal isOpen={Boolean(editRow)} onClose={() => setEditRow(null)} title="Edit final average">
        <div className="space-y-4">
          <Select
            label="Status"
            value={editStatus}
            onChange={(e) => setEditStatus(e.target.value as 'passed' | 'failed' | 'inc')}
            options={[
              { value: 'passed', label: 'Passed' },
              { value: 'failed', label: 'Failed' },
              { value: 'inc', label: 'INC' },
            ]}
          />
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            disabled={editStatus === 'inc'}
            value={editGrade}
            onChange={(e) => setEditGrade(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5"
            placeholder={editStatus === 'inc' ? 'Will save as INC for all quarters' : '0 - 100'}
          />
          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditRow(null)}>
              Cancel
            </Button>
            <Button type="button" className="flex-1" onClick={() => void saveEdit()}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
