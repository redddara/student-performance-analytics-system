import { useState, useEffect, useMemo } from 'react';
import { Download, ListFilter, Pencil, Plus, RefreshCw, Trash2, Upload, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageIntro } from '../../components/layouts/PageIntro';
import {
  GlassCard,
  Button,
  Input,
  Table,
  Modal,
  PageSkeletonLoader,
  Spinner,
  Select,
  ConfirmModal,
  MessageModal,
  type AppMessagePayload,
} from '../../components/ui';
import { useDataStore } from '../../store';
import { supabase } from '../../lib/supabase';
import { compareAlphabetical, sortByName, sortSelectOptions } from '../../lib/sortUtils';
import { CLASS_DAY_PRESET_OPTIONS } from '../../lib/classSchedule';

const TEACHER_UNASSIGNED = '__unassigned__';

function teacherLabel(t: { name?: string; first_name?: string; last_name?: string; username?: string }) {
  return t.name || `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.username || 'Teacher';
}

export default function AdminSubjectsPage() {
  const { subjects, courses, setSubjects, setCourses } = useDataStore();
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean; id: string | null; name: string | null}>({ isOpen: false, id: null, name: null });
  const [appMessage, setAppMessage] = useState<AppMessagePayload | null>(null);

  const [filterSearch, setFilterSearch] = useState('');
  const [filterCourseId, setFilterCourseId] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterTeacherId, setFilterTeacherId] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    course_id: '',
    year_level: '1st',
    semester: '1st Sem',
    teacher_id: '',
    class_days: '',
    prerequisite_subject_id: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [subjectsRes, coursesRes, teachersRes] = await Promise.all([
      supabase.from('subjects').select('*, course:courses(*), teacher:users(*)').order('name'),
      supabase.from('courses').select('*').order('name', { ascending: true }),
      supabase.from('users').select('*').eq('role', 'teacher').order('last_name', { ascending: true }),
    ]);
    setSubjects(subjectsRes.data || []);
    setCourses(coursesRes.data || []);
    setTeachers(teachersRes.data || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    const courseId = formData.course_id?.trim() || null;
    const teacherId = formData.teacher_id?.trim() || null;

    if (!courseId) {
      setAppMessage({
        title: 'Course required',
        message: 'Choose a course for this subject, or add a course first if the list is empty.',
        variant: 'warning',
      });
      return;
    }

    const code = formData.code.trim().toUpperCase();
    if (!code) {
      setAppMessage({ title: 'Code required', message: 'Every subject must have a unique code.', variant: 'warning' });
      setSubmitting(false);
      return;
    }

    const data = {
      code,
      name: formData.name.trim(),
      course_id: courseId,
      year_level: formData.year_level,
      semester: formData.semester,
      teacher_id: teacherId,
      class_days: formData.class_days?.trim() || null,
    };

    const savePrerequisite = async (subjectId: string) => {
      await supabase.from('subject_prerequisites').delete().eq('subject_id', subjectId);
      const prereqId = formData.prerequisite_subject_id?.trim();
      if (prereqId) {
        const { error: prereqError } = await supabase.from('subject_prerequisites').insert({
          subject_id: subjectId,
          prerequisite_subject_id: prereqId,
          minimum_grade: 75,
        });
        if (prereqError) throw prereqError;
      }
    };

    try {
      if (editingSubject) {
        const { error } = await supabase.from('subjects').update(data).eq('id', editingSubject.id);
        if (error) throw error;
        await savePrerequisite(editingSubject.id);
        setAppMessage({ title: 'Subject updated', message: `"${formData.name}" has been saved.`, variant: 'success' });
      } else {
        const { data: insertedSubject, error } = await supabase.from('subjects').insert(data).select('id').single();
        if (error) throw error;
        if (insertedSubject?.id) {
          const { data: siblingSubjects, error: siblingSubjectsError } = await supabase
            .from('subjects')
            .select('id')
            .eq('course_id', courseId)
            .eq('year_level', formData.year_level)
            .eq('semester', formData.semester)
            .neq('id', insertedSubject.id);
          if (siblingSubjectsError) throw siblingSubjectsError;

          let studentIds: string[] = [];
          const siblingIds = (siblingSubjects || []).map((s) => s.id).filter(Boolean);
          if (siblingIds.length > 0) {
            const { data: enrolledRows, error: enrolledFetchError } = await supabase
              .from('student_subjects')
              .select('student_id')
              .in('subject_id', siblingIds);
            if (enrolledFetchError) throw enrolledFetchError;
            studentIds = Array.from(
              new Set((enrolledRows || []).map((r) => r.student_id).filter(Boolean))
            );
          } else {
            const { data: matchingStudents, error: studentFetchError } = await supabase
              .from('students')
              .select('id')
              .eq('course_id', courseId)
              .eq('grade_level', formData.year_level);
            if (studentFetchError) throw studentFetchError;
            studentIds = (matchingStudents || []).map((s) => s.id).filter(Boolean);
          }
          if (studentIds.length > 0) {
            const enrollments = studentIds.map((sid) => ({
              student_id: sid,
              subject_id: insertedSubject.id,
            }));

            const { error: enrollmentError } = await supabase
              .from('student_subjects')
              .upsert(enrollments, { onConflict: 'student_id,subject_id', ignoreDuplicates: true });
            if (enrollmentError) throw enrollmentError;
          }
          await savePrerequisite(insertedSubject.id);
        }
        setAppMessage({ title: 'Subject added', message: `"${formData.name}" is now in the catalog.`, variant: 'success' });
      }

      setShowModal(false);
      setFormData({
        code: '',
        name: '',
        course_id: '',
        year_level: '1st',
        semester: '1st Sem',
        teacher_id: '',
        class_days: '',
        prerequisite_subject_id: '',
      });
      setEditingSubject(null);
      loadData();
    } catch (err: any) {
      setAppMessage({
        title: 'Could not save subject',
        message: err.message || 'Check required fields and try again.',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (subject: any) => {
    setEditingSubject(subject);
    const { data: prereqRow } = await supabase
      .from('subject_prerequisites')
      .select('prerequisite_subject_id')
      .eq('subject_id', subject.id)
      .maybeSingle();
    setFormData({
      code: subject.code || '',
      name: subject.name,
      course_id: subject.course_id ?? '',
      year_level: subject.year_level || '1st',
      semester: subject.semester || '1st Sem',
      teacher_id: subject.teacher_id || '',
      class_days: subject.class_days || '',
      prerequisite_subject_id: prereqRow?.prerequisite_subject_id || '',
    });
    setShowModal(true);
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteConfirm({ isOpen: true, id, name });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return;
    const name = deleteConfirm.name || 'Subject';
    try {
      const { error } = await supabase.from('subjects').delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      setAppMessage({ title: 'Subject deleted', message: `"${name}" has been removed.`, variant: 'success' });
      loadData();
    } catch (err: any) {
      setAppMessage({
        title: 'Could not delete subject',
        message: err.message || 'It may still have grades or enrollments.',
        variant: 'error',
      });
    } finally {
      setDeleteConfirm({ isOpen: false, id: null, name: null });
    }
  };

  const sortedCourses = useMemo(() => sortByName(courses), [courses]);

  const sortedTeachers = useMemo(
    () => [...teachers].sort((a, b) => compareAlphabetical(teacherLabel(a), teacherLabel(b))),
    [teachers]
  );

  const filteredSubjects = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    const filtered = subjects.filter((s) => {
      if (q && !String(s.name || '').toLowerCase().includes(q) && !String(s.code || '').toLowerCase().includes(q)) return false;
      if (filterCourseId && s.course_id !== filterCourseId) return false;
      if (filterYear && (s.year_level || '') !== filterYear) return false;
      if (filterSemester && (s.semester || '') !== filterSemester) return false;
      if (filterTeacherId === TEACHER_UNASSIGNED) {
        if (s.teacher_id) return false;
      } else if (filterTeacherId && s.teacher_id !== filterTeacherId) return false;
      return true;
    });
    return sortByName(filtered);
  }, [subjects, filterSearch, filterCourseId, filterYear, filterSemester, filterTeacherId]);

  const hasActiveFilters =
    Boolean(filterSearch.trim()) ||
    Boolean(filterCourseId) ||
    Boolean(filterYear) ||
    Boolean(filterSemester) ||
    Boolean(filterTeacherId);

  const clearFilters = () => {
    setFilterSearch('');
    setFilterCourseId('');
    setFilterYear('');
    setFilterSemester('');
    setFilterTeacherId('');
  };

  if (loading) {
    return <DashboardLayout title="Subjects"><PageSkeletonLoader rows={4} /></DashboardLayout>;
  }

  return (
    <DashboardLayout title="Subject Management">
      <PageIntro
        title="Subjects & Assignments"
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="glass"
          onClick={() => {
            setEditingSubject(null);
            setFormData({
              code: '',
              name: '',
              course_id: '',
              year_level: '1st',
              semester: '1st Sem',
              teacher_id: '',
              class_days: '',
              prerequisite_subject_id: '',
            });
            setShowModal(true);
          }}
          className="w-full sm:w-auto"
        >
          <Plus className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          Add Subject
        </Button>
        <Button type="button" variant="secondary" onClick={() => setShowBulkModal(true)} className="w-full sm:w-auto">
          <Upload className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          Bulk Add Subjects
        </Button>
        <button
          type="button"
          onClick={() => setFiltersOpen(o => !o)}
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
            Showing <span className="font-semibold text-[#800000]">{filteredSubjects.length}</span>
            {' / '}
            {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Search by name"
              placeholder="Type to filter…"
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
            />
            <Select
              label="Course"
              value={filterCourseId}
              onChange={e => setFilterCourseId(e.target.value)}
              options={sortSelectOptions([{ value: '', label: 'All courses' }, ...sortedCourses.map(c => ({ value: c.id, label: c.name }))], [''])}
            />
            <Select
              label="Year level"
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
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
              onChange={e => setFilterSemester(e.target.value)}
              options={[
                { value: '', label: 'All semesters' },
                { value: '1st Sem', label: '1st Sem' },
                { value: '2nd Sem', label: '2nd Sem' },
              ]}
            />
            <Select
              label="Teacher"
              value={filterTeacherId}
              onChange={e => setFilterTeacherId(e.target.value)}
              options={sortSelectOptions(
                [
                  { value: '', label: 'All teachers' },
                  { value: TEACHER_UNASSIGNED, label: 'No teacher assigned' },
                  ...sortedTeachers.map(t => ({ value: t.id, label: teacherLabel(t) })),
                ],
                ['', TEACHER_UNASSIGNED]
              )}
            />
          </div>
          <p className="mt-4 text-sm text-gray-600">
            Showing <span className="font-semibold text-[#800000]">{filteredSubjects.length}</span>
            {' '}of {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      
      <GlassCard className="p-4 sm:p-6">
        <Table headers={['Code', 'Subject Name', 'Course', 'Year Level', 'Semester', 'Teacher', 'Actions']}>
          {filteredSubjects.map(subject => (
            <tr key={subject.id} className="hover:bg-white/20">
              <td className="px-4 py-3 font-mono text-sm font-semibold text-[#800000]">{subject.code || '—'}</td>
              <td className="px-4 py-3 font-medium text-gray-800">{subject.name}</td>
              <td className="px-4 py-3 text-gray-600">{subject.course?.name || '-'}</td>
              <td className="px-4 py-3 text-gray-600">{subject.year_level || '-'}</td>
              <td className="px-4 py-3 text-gray-600">{subject.semester || '-'}</td>
              <td className="px-4 py-3 text-gray-600">
                {subject.teacher ? `${subject.teacher.first_name || ''} ${subject.teacher.last_name || ''}`.trim() || subject.teacher.name || '-' : '-'}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="p-2 rounded-lg glass-hover text-[#800000]"
                    onClick={() => handleEdit(subject)}
                    aria-label={`Edit ${subject.name}`}
                    title={`Edit ${subject.name}`}
                  >
                    <Pencil className="h-[1.15rem] w-[1.15rem] shrink-0" strokeWidth={2} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="p-2 rounded-lg glass-hover text-red-600"
                    onClick={() => handleDelete(subject.id, subject.name)}
                    aria-label={`Delete ${subject.name}`}
                    title={`Delete ${subject.name}`}
                  >
                    <Trash2 className="h-[1.15rem] w-[1.15rem] shrink-0" strokeWidth={2} aria-hidden />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
        {subjects.length === 0 && <p className="text-center text-gray-500 py-8">No subjects yet</p>}
        {subjects.length > 0 && filteredSubjects.length === 0 && (
          <p className="text-center text-gray-500 py-8">No subjects match your filters. Try adjusting or clear filters.</p>
        )}
      </GlassCard>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setFormData({ code: '', name: '', course_id: '', year_level: '1st', semester: '1st Sem', teacher_id: '', class_days: '', prerequisite_subject_id: '' }); setEditingSubject(null); }} title={editingSubject ? 'Edit Subject' : 'Add Subject'}>
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <Input
            label="Subject Code"
            name="subject-code"
            value={formData.code}
            onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            placeholder="e.g., IT101"
            required
          />
          <Input
            label="Subject Name"
            name="subject-display-name"
            autoComplete="off"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Select
            label="Course"
            name="sapas-subject-course"
            autoComplete="off"
            value={formData.course_id}
            onChange={e => setFormData({ ...formData, course_id: e.target.value })}
            options={
              editingSubject
                ? sortedCourses.map(c => ({ value: c.id, label: c.name }))
                : [{ value: '', label: 'Select a course' }, ...sortedCourses.map(c => ({ value: c.id, label: c.name }))]
            }
            required
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Year Level" value={formData.year_level} onChange={e => setFormData({ ...formData, year_level: e.target.value })} options={[{ value: '1st', label: '1st Year' }, { value: '2nd', label: '2nd Year' }, { value: '3rd', label: '3rd Year' }, { value: '4th', label: '4th Year' }]} />
            <Select label="Semester" value={formData.semester} onChange={e => setFormData({ ...formData, semester: e.target.value })} options={[{ value: '1st Sem', label: '1st Sem' }, { value: '2nd Sem', label: '2nd Sem' }]} />
          </div>
          <Select label="Teacher (Optional)" value={formData.teacher_id} onChange={e => setFormData({ ...formData, teacher_id: e.target.value })} options={[{ value: '', label: 'No Teacher' }, ...sortedTeachers.map(t => ({ value: t.id, label: teacherLabel(t) }))]} />
          <Select
            label="Class days (attendance schedule)"
            value={formData.class_days}
            onChange={(e) => setFormData({ ...formData, class_days: e.target.value })}
            options={CLASS_DAY_PRESET_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
          />
          <Select
            label="Prerequisite subject (optional)"
            value={formData.prerequisite_subject_id}
            onChange={(e) => setFormData({ ...formData, prerequisite_subject_id: e.target.value })}
            options={[
              { value: '', label: 'None — no prerequisite' },
              ...sortByName(
                subjects.filter(
                  (s) =>
                    s.id !== editingSubject?.id &&
                    (!formData.course_id || s.course_id === formData.course_id)
                )
              ).map((s) => ({
                value: s.id,
                label: `${s.code || ''} ${s.name} (${s.semester || '—'})`.trim(),
              })),
            ]}
          />
          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowModal(false);
                setFormData({
                  code: '',
                  name: '',
                  course_id: '',
                  year_level: '1st',
                  semester: '1st Sem',
                  teacher_id: '',
                  class_days: '',
                  prerequisite_subject_id: '',
                });
                setEditingSubject(null);
              }}
            >
              <XCircle className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? (
                <Spinner size="sm" />
              ) : editingSubject ? (
                <Pencil className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              ) : (
                <Plus className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              )}
              {submitting ? 'Saving…' : editingSubject ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null, name: null })}
        onConfirm={confirmDelete}
        title="Delete Subject"
        message={`Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />

      {appMessage && (
        <MessageModal
          isOpen
          onClose={() => setAppMessage(null)}
          title={appMessage.title}
          message={appMessage.message}
          variant={appMessage.variant}
        />
      )}

      <Modal isOpen={showBulkModal} onClose={() => { setShowBulkModal(false); setBulkResults(null); }} title="Bulk Add Subjects" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Required columns: <code>code</code>, <code>name</code>, <code>course_name</code>, <code>year_level</code>, <code>semester</code>.
            Optional: <code>teacher_email</code>, <code>class_days</code>.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const template = [{
                  code: 'IT101',
                  name: 'Introduction to Computing',
                  course_name: courses[0]?.name || 'BSCS',
                  year_level: '1st',
                  semester: '1st Sem',
                  teacher_email: '',
                  class_days: '',
                }];
                const ws = XLSX.utils.json_to_sheet(template);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Subjects');
                XLSX.writeFile(wb, 'bulk_subjects_template.xlsx');
              }}
            >
              <Download className="h-5 w-5 shrink-0" />
              Download template
            </Button>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={bulkLoading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBulkLoading(true);
                setBulkResults(null);
                try {
                  const buffer = await file.arrayBuffer();
                  const wb = XLSX.read(buffer);
                  const rows = XLSX.utils.sheet_to_json<{
                    code?: string;
                    name?: string;
                    course_name?: string;
                    year_level?: string;
                    semester?: string;
                    teacher_email?: string;
                    class_days?: string;
                  }>(wb.Sheets[wb.SheetNames[0]]);
                  const codeSet = new Set(subjects.map((s) => String(s.code || '').toUpperCase()));
                  let success = 0;
                  let failed = 0;
                  const errors: string[] = [];
                  for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    const rowNo = i + 2;
                    const code = String(row.code || '').trim().toUpperCase();
                    const name = String(row.name || '').trim();
                    const courseName = String(row.course_name || '').trim().toLowerCase();
                    const yearLevel = String(row.year_level || '1st').trim();
                    const semester = String(row.semester || '1st Sem').trim();
                    if (!code || !name || !courseName) {
                      failed += 1;
                      errors.push(`Row ${rowNo}: code, name, and course_name are required.`);
                      continue;
                    }
                    if (codeSet.has(code)) {
                      failed += 1;
                      errors.push(`Row ${rowNo}: code "${code}" already exists.`);
                      continue;
                    }
                    const course = courses.find((c) => String(c.name || '').trim().toLowerCase() === courseName);
                    if (!course?.id) {
                      failed += 1;
                      errors.push(`Row ${rowNo}: course "${row.course_name}" not found.`);
                      continue;
                    }
                    let teacherId: string | null = null;
                    const teacherEmail = String(row.teacher_email || '').trim().toLowerCase();
                    if (teacherEmail) {
                      const teacher = teachers.find((t) => String(t.email || '').trim().toLowerCase() === teacherEmail);
                      if (!teacher?.id) {
                        failed += 1;
                        errors.push(`Row ${rowNo}: teacher email not found.`);
                        continue;
                      }
                      teacherId = teacher.id;
                    }
                    const { data: inserted, error } = await supabase
                      .from('subjects')
                      .insert({
                        code,
                        name,
                        course_id: course.id,
                        year_level: yearLevel,
                        semester,
                        teacher_id: teacherId,
                        class_days: String(row.class_days || '').trim() || null,
                      })
                      .select('id')
                      .single();
                    if (error || !inserted?.id) {
                      failed += 1;
                      errors.push(`Row ${rowNo}: ${error?.message || 'insert failed'}`);
                      continue;
                    }
                    const { data: matchingStudents } = await supabase
                      .from('students')
                      .select('id')
                      .eq('course_id', course.id)
                      .eq('grade_level', yearLevel);
                    if (matchingStudents?.length) {
                      await supabase.from('student_subjects').upsert(
                        matchingStudents.map((s) => ({ student_id: s.id, subject_id: inserted.id })),
                        { onConflict: 'student_id,subject_id', ignoreDuplicates: true }
                      );
                    }
                    codeSet.add(code);
                    success += 1;
                  }
                  setBulkResults({ success, failed, errors: errors.slice(0, 12) });
                  setAppMessage({
                    title: 'Bulk import finished',
                    message: `Created ${success} subject(s). Failed: ${failed}.`,
                    variant: failed > 0 ? 'warning' : 'success',
                  });
                  loadData();
                } finally {
                  setBulkLoading(false);
                  e.target.value = '';
                }
              }}
              className="w-full min-w-0 text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-[#800000] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
          </div>
          {bulkLoading && <Spinner size="sm" />}
          {bulkResults && (
            <div className="grid grid-cols-2 gap-3 text-center text-sm">
              <div className="rounded-xl border border-green-200 bg-green-50 p-3">
                <p className="text-xl font-bold text-green-700">{bulkResults.success}</p>
                <p>Created</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-xl font-bold text-red-700">{bulkResults.failed}</p>
                <p>Failed</p>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </DashboardLayout>
  );
}

