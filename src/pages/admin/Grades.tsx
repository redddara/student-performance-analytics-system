import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Lock, LockOpen, Pencil } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageIntro } from '../../components/layouts/PageIntro';
import { Button, GlassCard, Modal, Select, Table, PageSkeletonLoader } from '../../components/ui';
import { useAuthStore } from '../../store';
import {
  supabase,
  computeSubjectFinalAverage,
  formatGradePoint,
  getGradeRemarks,
  gradeValueForStorage,
} from '../../lib/supabase';
import { useSupabaseLiveReload } from '../../lib/useSupabaseLiveReload';
import { formatPersonDisplayName } from '../../lib/personName';
import {
  compareAlphabetical,
  courseSelectOptions,
  sortByLabel,
  subjectSelectOptions,
} from '../../lib/sortUtils';

type FinalAverageRow = {
  key: string;
  student_id: string;
  subject_id: string;
  semester: number;
  student_name: string;
  course_name: string;
  course_id: string;
  section: string;
  year_level: string;
  subject_name: string;
  subject_code: string;
  quarter_count: number;
  final_average: number | null;
  final_grade_point: number | null;
  status: 'passed' | 'failed' | 'inc';
  grade_ids: string[];
};

type GradeSectionGroup = {
  key: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  semester: number;
  course_id: string;
  course_name: string;
  section: string;
  year_level: string;
  rows: FinalAverageRow[];
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
          if (effectiveSchoolYearId) {
            query = query.eq('school_year_id', effectiveSchoolYearId);
          }
          return query;
        })(),
        supabase.from('students').select('id,first_name,last_name,section,grade_level,course_id'),
        supabase.from('subjects').select('id,name,code,course_id'),
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
      const name = formatPersonDisplayName(st || {}).toLowerCase();
      const courseName = String(courses.find((c) => c.id === st?.course_id)?.name || '').toLowerCase();
      return (
        name.includes(term) ||
        String(sb?.name || '').toLowerCase().includes(term) ||
        String(sb?.code || '').toLowerCase().includes(term) ||
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
      const summary = computeSubjectFinalAverage(list);
      rows.push({
        key,
        student_id: first.student_id,
        subject_id: first.subject_id,
        semester: first.semester,
        student_name: formatPersonDisplayName(st || {}),
        course_name: cr?.name || '',
        course_id: st?.course_id || '',
        section: st?.section || '',
        year_level: st?.grade_level || '',
        subject_name: sb?.name || '',
        subject_code: sb?.code || '',
        quarter_count: summary.quarterCount,
        final_average: summary.averagePercent,
        final_grade_point: summary.gradePoint,
        status: summary.status,
        grade_ids: list.map((g) => g.id),
      });
    }

    return rows.sort((a, b) => compareAlphabetical(a.student_name, b.student_name));
  }, [filtered, students, subjects, courses]);

  const sectionGroups = useMemo<GradeSectionGroup[]>(() => {
    const byGroup = new Map<string, FinalAverageRow[]>();
    for (const row of finalRows) {
      const groupKey = [
        row.subject_id,
        row.semester,
        row.course_id || 'none',
        row.section || 'none',
        row.year_level || 'none',
      ].join('__');
      const list = byGroup.get(groupKey) || [];
      list.push(row);
      byGroup.set(groupKey, list);
    }

    const groups: GradeSectionGroup[] = [];
    for (const [key, rows] of byGroup.entries()) {
      const first = rows[0];
      groups.push({
        key,
        subject_id: first.subject_id,
        subject_name: first.subject_name,
        subject_code: first.subject_code,
        semester: first.semester,
        course_id: first.course_id,
        course_name: first.course_name,
        section: first.section,
        year_level: first.year_level,
        rows: rows.sort((a, b) => compareAlphabetical(a.student_name, b.student_name)),
        grade_ids: rows.flatMap((r) => r.grade_ids),
      });
    }

    return groups.sort((a, b) => {
      const courseCmp = compareAlphabetical(a.course_name, b.course_name);
      if (courseCmp !== 0) return courseCmp;
      const sectionCmp = compareAlphabetical(a.section, b.section);
      if (sectionCmp !== 0) return sectionCmp;
      const yearCmp = compareAlphabetical(a.year_level, b.year_level);
      if (yearCmp !== 0) return yearCmp;
      const subjectCmp = compareAlphabetical(a.subject_name, b.subject_name);
      if (subjectCmp !== 0) return subjectCmp;
      return a.semester - b.semester;
    });
  }, [finalRows]);

  const sortedCourses = useMemo(() => courseSelectOptions(courses), [courses]);
  const sortedSchoolYears = useMemo(
    () => sortByLabel((schoolYears || []).map((sy) => ({ value: sy.id, label: sy.name || '' }))),
    [schoolYears]
  );

  const exportCsv = () => {
    const rows = finalRows.map((r) => {
      return {
        student: r.student_name,
        course: r.course_name,
        section: r.section,
        subject_code: r.subject_code,
        subject: r.subject_name,
        semester: r.semester,
        quarters_included: r.quarter_count,
        final_average:
          r.status === 'inc'
            ? 'INC'
            : r.final_average != null && r.final_grade_point != null
              ? `${r.final_average}% → ${formatGradePoint(r.final_grade_point)}`
              : r.final_average,
        status: r.status.toUpperCase(),
      };
    });
    const header = Object.keys(rows[0] || {
      student: '',
      course: '',
      section: '',
      subject_code: '',
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
    const gradeToStore = gradeValueForStorage(editGrade);
    if (editStatus !== 'inc' && gradeToStore == null) return;
    const payload =
      editStatus === 'inc'
        ? { grade_status: 'inc', grade: 0, remarks: 'INC' }
        : {
            grade_status: editStatus,
            grade: gradeToStore!,
            remarks: getGradeRemarks(gradeToStore!),
          };

    await supabase
      .from('grades')
      .update(payload)
      .in('id', editRow.grade_ids || []);
    setEditRow(null);
    await loadData();
  };

  const approveAndLock = async (group: GradeSectionGroup) => {
    if (!group.grade_ids.length) return;
    setActionLoadingKey(`${group.key}:lock`);
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
      .in('id', group.grade_ids);
    setActionLoadingKey('');
    await loadData();
  };

  const approveUnlock = async (group: GradeSectionGroup) => {
    if (!group.grade_ids.length) return;
    setActionLoadingKey(`${group.key}:unlock`);
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
        .in('id', group.grade_ids);
      await loadData();
    } finally {
      setActionLoadingKey('');
    }
  };

  const groupWorkflowLabel = (group: GradeSectionGroup) => {
    const relatedGrades = grades.filter((g) => group.grade_ids.includes(g.id));
    const anyLocked = relatedGrades.some((g) => Boolean(g.is_locked));
    const anyUnlockRequested = relatedGrades.some((g) => Boolean(g.unlock_requested));
    const hasForReview = relatedGrades.some((g) => g.workflow_status === 'for_review');
    return anyLocked ? 'LOCKED' : anyUnlockRequested ? 'UNLOCK REQUESTED' : hasForReview ? 'FOR REVIEW' : 'DRAFT';
  };

  const workflowBadgeClass = (label: string) => {
    switch (label) {
      case 'LOCKED':
        return 'bg-emerald-500/20 text-emerald-100 ring-emerald-400/40';
      case 'UNLOCK REQUESTED':
        return 'bg-amber-500/25 text-amber-100 ring-amber-400/45';
      case 'FOR REVIEW':
        return 'bg-sky-500/25 text-sky-100 ring-sky-400/45';
      default:
        return 'bg-white/15 text-white/90 ring-white/25';
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
          placeholder="Search student, subject code, course, or section..."
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
            ...sortedSchoolYears,
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
          options={subjectSelectOptions(subjects)}
        />
        <Select
          label="Course"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          options={sortedCourses}
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
          Showing <span className="font-semibold text-[#800000]">{finalRows.length}</span> student record
          {finalRows.length !== 1 ? 's' : ''} in{' '}
          <span className="font-semibold text-[#800000]">{sectionGroups.length}</span> class group
          {sectionGroups.length !== 1 ? 's' : ''} (course · section · year · subject).
        </p>
        <Button type="button" onClick={exportCsv}>
          <Download className="h-5 w-5 shrink-0" />
          Export Filtered CSV
        </Button>
      </div>
      <div className="space-y-6">
        {sectionGroups.map((group) => {
          const relatedGrades = grades.filter((g) => group.grade_ids.includes(g.id));
          const anyLocked = relatedGrades.some((g) => Boolean(g.is_locked));
          const workflowLabel = groupWorkflowLabel(group);
          return (
            <GlassCard key={group.key} variant="plain" className="overflow-hidden p-0 shadow-md">
              <div className="border-b border-gold-500/25 bg-gradient-to-r from-[#4a0000] via-[#660000] to-[#800000] px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gold-200/90">
                      {group.course_name || '—'} · Section {group.section || '—'} ·{' '}
                      {group.year_level ? `${group.year_level} Year` : '—'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {group.subject_code ? (
                        <span className="rounded-md bg-gold-400/20 px-2.5 py-1 font-mono text-sm font-bold tracking-wide text-gold-100 ring-1 ring-gold-400/40">
                          {group.subject_code}
                        </span>
                      ) : null}
                      <h3 className="text-base font-semibold text-white sm:text-lg">
                        {group.subject_name || '—'}
                      </h3>
                    </div>
                    <p className="text-sm text-white/75">
                      Semester {group.semester} · {group.rows.length} student
                      {group.rows.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    <span
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wide ring-1 ${workflowBadgeClass(workflowLabel)}`}
                    >
                      {workflowLabel}
                    </span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={anyLocked || actionLoadingKey === `${group.key}:lock`}
                      onClick={() => void approveAndLock(group)}
                      title="Approve and lock all grades in this class group"
                    >
                      <Lock className="h-4 w-4 shrink-0" />
                      Lock all
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/50 bg-amber-500/20 px-3 py-2 text-sm font-medium text-amber-50 hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={!anyLocked || actionLoadingKey === `${group.key}:unlock`}
                      onClick={() => void approveUnlock(group)}
                      title={anyLocked ? 'Unlock all grades in this class group' : 'Already unlocked'}
                    >
                      <LockOpen className="h-4 w-4 shrink-0" />
                      Unlock all
                    </button>
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 sm:p-6">
                <Table variant="light" headers={['Student', 'Periods', 'Final Average', 'Status', 'Edit']}>
                  {group.rows.map((row) => {
                    const rowLocked = grades
                      .filter((g) => row.grade_ids.includes(g.id))
                      .some((g) => Boolean(g.is_locked));
                    return (
                      <tr key={row.key} className="hover:bg-gray-50/80">
                        <td className="px-4 py-3 font-medium text-gray-900">{row.student_name || '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{row.quarter_count}</td>
                        <td className="px-4 py-3 text-gray-800">
                          {row.status === 'inc'
                            ? 'INC'
                            : row.final_average != null && row.final_grade_point != null
                              ? `${row.final_average}% → ${formatGradePoint(row.final_grade_point)}`
                              : row.final_average ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              row.status === 'passed'
                                ? 'font-semibold text-green-700'
                                : row.status === 'failed'
                                  ? 'font-semibold text-red-700'
                                  : 'font-semibold text-amber-700'
                            }
                          >
                            {row.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="rounded-lg border border-gray-200 p-2 text-[#800000] hover:bg-maroon-50 disabled:opacity-50"
                            disabled={rowLocked}
                            onClick={() => {
                              setEditRow(row);
                              setEditStatus(row.status);
                              setEditGrade(String(row.final_average ?? ''));
                            }}
                            title={rowLocked ? 'Locked grades cannot be edited.' : 'Edit final average'}
                          >
                            <Pencil className="h-[1.1rem] w-[1.1rem] shrink-0" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </Table>
              </div>
            </GlassCard>
          );
        })}
        {sectionGroups.length === 0 && (
          <GlassCard variant="plain" className="p-6 text-center text-sm text-gray-500">
            No grade records match the current filters.
          </GlassCard>
        )}
      </div>

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
