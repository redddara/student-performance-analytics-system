import { useState, useEffect, useMemo } from 'react';
import { ListFilter, Pencil, Plus, RefreshCw, Trash2, XCircle } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageIntro } from '../../components/layouts/PageIntro';
import {
  GlassCard,
  Button,
  Input,
  Table,
  Modal,
  Spinner,
  Select,
  ConfirmModal,
  MessageModal,
  type AppMessagePayload,
} from '../../components/ui';
import { useDataStore } from '../../store';
import { supabase } from '../../lib/supabase';

const TEACHER_UNASSIGNED = '__unassigned__';

function teacherLabel(t: { name?: string; first_name?: string; last_name?: string; username?: string }) {
  return t.name || `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.username || 'Teacher';
}

export default function AdminSubjectsPage() {
  const { subjects, courses, setSubjects, setCourses } = useDataStore();
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean; id: string | null; name: string | null}>({ isOpen: false, id: null, name: null });
  const [appMessage, setAppMessage] = useState<AppMessagePayload | null>(null);

  const [filterSearch, setFilterSearch] = useState('');
  const [filterCourseId, setFilterCourseId] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterTeacherId, setFilterTeacherId] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    course_id: '',
    year_level: '1st',
    semester: '1st Sem',
    teacher_id: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [subjectsRes, coursesRes, teachersRes] = await Promise.all([
      supabase.from('subjects').select('*, course:courses(*), teacher:users(*)').order('name'),
      supabase.from('courses').select('*'),
      supabase.from('users').select('*').eq('role', 'teacher'),
    ]);
    setSubjects(subjectsRes.data || []);
    setCourses(coursesRes.data || []);
    setTeachers(teachersRes.data || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

    const data = {
      name: formData.name.trim(),
      course_id: courseId,
      year_level: formData.year_level,
      semester: formData.semester,
      teacher_id: teacherId,
    };

    try {
      if (editingSubject) {
        const { error } = await supabase.from('subjects').update(data).eq('id', editingSubject.id);
        if (error) throw error;
        setAppMessage({ title: 'Subject updated', message: `"${formData.name}" has been saved.`, variant: 'success' });
      } else {
        const { error } = await supabase.from('subjects').insert(data);
        if (error) throw error;
        setAppMessage({ title: 'Subject added', message: `"${formData.name}" is now in the catalog.`, variant: 'success' });
      }

      setShowModal(false);
      setFormData({ name: '', course_id: '', year_level: '1st', semester: '1st Sem', teacher_id: '' });
      setEditingSubject(null);
      loadData();
    } catch (err: any) {
      setAppMessage({
        title: 'Could not save subject',
        message: err.message || 'Check required fields and try again.',
        variant: 'error',
      });
    }
  };

  const handleEdit = (subject: any) => {
    setEditingSubject(subject);
    setFormData({
      name: subject.name,
      course_id: subject.course_id ?? '',
      year_level: subject.year_level || '1st',
      semester: subject.semester || '1st Sem',
      teacher_id: subject.teacher_id || '',
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

  const filteredSubjects = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return subjects.filter(s => {
      if (q && !String(s.name || '').toLowerCase().includes(q)) return false;
      if (filterCourseId && s.course_id !== filterCourseId) return false;
      if (filterYear && (s.year_level || '') !== filterYear) return false;
      if (filterSemester && (s.semester || '') !== filterSemester) return false;
      if (filterTeacherId === TEACHER_UNASSIGNED) {
        if (s.teacher_id) return false;
      } else if (filterTeacherId && s.teacher_id !== filterTeacherId) return false;
      return true;
    });
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
    return <DashboardLayout title="Subjects"><Spinner size="lg" /></DashboardLayout>;
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
              name: '',
              course_id: '',
              year_level: '1st',
              semester: '1st Sem',
              teacher_id: '',
            });
            setShowModal(true);
          }}
          className="w-full sm:w-auto"
        >
          <Plus className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          Add Subject
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
              options={[{ value: '', label: 'All courses' }, ...courses.map(c => ({ value: c.id, label: c.name }))]}
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
              options={[
                { value: '', label: 'All teachers' },
                { value: TEACHER_UNASSIGNED, label: 'No teacher assigned' },
                ...teachers.map(t => ({ value: t.id, label: teacherLabel(t) })),
              ]}
            />
          </div>
          <p className="mt-4 text-sm text-gray-600">
            Showing <span className="font-semibold text-[#800000]">{filteredSubjects.length}</span>
            {' '}of {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      
      <GlassCard className="p-4 sm:p-6">
        <Table headers={['Subject Name', 'Course', 'Year Level', 'Semester', 'Teacher', 'Actions']}>
          {filteredSubjects.map(subject => (
            <tr key={subject.id} className="hover:bg-white/20">
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

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setFormData({ name: '', course_id: '', year_level: '1st', semester: '1st Sem', teacher_id: '' }); setEditingSubject(null); }} title={editingSubject ? 'Edit Subject' : 'Add Subject'}>
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
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
                ? courses.map(c => ({ value: c.id, label: c.name }))
                : [{ value: '', label: 'Select a course' }, ...courses.map(c => ({ value: c.id, label: c.name }))]
            }
            required
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Year Level" value={formData.year_level} onChange={e => setFormData({ ...formData, year_level: e.target.value })} options={[{ value: '1st', label: '1st Year' }, { value: '2nd', label: '2nd Year' }, { value: '3rd', label: '3rd Year' }, { value: '4th', label: '4th Year' }]} />
            <Select label="Semester" value={formData.semester} onChange={e => setFormData({ ...formData, semester: e.target.value })} options={[{ value: '1st Sem', label: '1st Sem' }, { value: '2nd Sem', label: '2nd Sem' }]} />
          </div>
          <Select label="Teacher (Optional)" value={formData.teacher_id} onChange={e => setFormData({ ...formData, teacher_id: e.target.value })} options={[{ value: '', label: 'No Teacher' }, ...teachers.map(t => ({ value: t.id, label: t.name || `${t.first_name} ${t.last_name}` || t.username }))]} />
          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowModal(false);
                setFormData({
                  name: '',
                  course_id: '',
                  year_level: '1st',
                  semester: '1st Sem',
                  teacher_id: '',
                });
                setEditingSubject(null);
              }}
            >
              <XCircle className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              {editingSubject ? (
                <Pencil className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              ) : (
                <Plus className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              )}
              {editingSubject ? 'Update' : 'Create'}
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
    </DashboardLayout>
  );
}

