import { useState, useEffect } from 'react';
import { Pencil, Plus, Trash2, XCircle } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageIntro } from '../../components/layouts/PageIntro';
import {
  GlassCard,
  Button,
  Input,
  Table,
  Modal,
  Spinner,
  ConfirmModal,
  MessageModal,
  type AppMessagePayload,
} from '../../components/ui';
import { useDataStore } from '../../store';
import { supabase } from '../../lib/supabase';

export default function AdminCoursesPage() {
  const { courses, setCourses } = useDataStore();
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [courseName, setCourseName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean; id: string | null; name: string | null}>({ isOpen: false, id: null, name: null });
  const [appMessage, setAppMessage] = useState<AppMessagePayload | null>(null);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    const { data } = await supabase.from('courses').select('*').order('name');
    setCourses(data || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCourse) {
        const { error } = await supabase.from('courses').update({ name: courseName }).eq('id', editingCourse.id);
        if (error) throw error;
        setAppMessage({ title: 'Course updated', message: `"${courseName}" has been saved.`, variant: 'success' });
      } else {
        const { error } = await supabase.from('courses').insert({ name: courseName });
        if (error) throw error;
        setAppMessage({ title: 'Course added', message: `"${courseName}" is now available for subjects and students.`, variant: 'success' });
      }

      setShowModal(false);
      setCourseName('');
      setEditingCourse(null);
      loadCourses();
    } catch (err: any) {
      setAppMessage({
        title: 'Could not save course',
        message: err.message || 'Check your connection and try again.',
        variant: 'error',
      });
    }
  };

  const handleEdit = (course: any) => {
    setEditingCourse(course);
    setCourseName(course.name);
    setShowModal(true);
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteConfirm({ isOpen: true, id, name });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return;
    const name = deleteConfirm.name || 'Course';
    try {
      const { error } = await supabase.from('courses').delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      setAppMessage({ title: 'Course deleted', message: `"${name}" has been removed.`, variant: 'success' });
      loadCourses();
    } catch (err: any) {
      setAppMessage({
        title: 'Could not delete course',
        message: err.message || 'It may still be linked to subjects or students.',
        variant: 'error',
      });
    } finally {
      setDeleteConfirm({ isOpen: false, id: null, name: null });
    }
  };

  if (loading) {
    return <DashboardLayout title="Courses"><Spinner size="lg" /></DashboardLayout>;
  }

  return (
    <DashboardLayout title="Course Management">
      <PageIntro
        title="Programs & courses"
        subtitle="Add and maintain degree programs. Course names are used for student ID prefixes (e.g. Office Administration → STUD-OA-) and subject assignment."
      />
      <Button
        type="button"
        variant="glass"
        onClick={() => setShowModal(true)}
        className="mb-6 w-full sm:w-auto"
      >
        <Plus className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
        Add Course
      </Button>
      
      <GlassCard className="p-4 sm:p-6">
        <Table headers={['Course Name', 'Actions']}>
          {courses.map(course => (
            <tr key={course.id} className="hover:bg-white/20">
              <td className="px-4 py-3 font-medium text-gray-800">{course.name}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="p-2 rounded-lg glass-hover text-[#800000]"
                    onClick={() => handleEdit(course)}
                    aria-label={`Edit ${course.name}`}
                    title={`Edit ${course.name}`}
                  >
                    <Pencil className="h-[1.15rem] w-[1.15rem] shrink-0" strokeWidth={2} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="p-2 rounded-lg glass-hover text-red-600"
                    onClick={() => handleDelete(course.id, course.name)}
                    aria-label={`Delete ${course.name}`}
                    title={`Delete ${course.name}`}
                  >
                    <Trash2 className="h-[1.15rem] w-[1.15rem] shrink-0" strokeWidth={2} aria-hidden />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
        {courses.length === 0 && <p className="text-center text-gray-500 py-8">No courses yet</p>}
      </GlassCard>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setCourseName(''); setEditingCourse(null); }} title={editingCourse ? 'Edit Course' : 'Add Course'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Course Name" value={courseName} onChange={e => setCourseName(e.target.value)} placeholder="e.g., BSCS" required />
          <div className="flex gap-4">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowModal(false);
                setCourseName('');
                setEditingCourse(null);
              }}
            >
              <XCircle className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              {editingCourse ? (
                <Pencil className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              ) : (
                <Plus className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              )}
              {editingCourse ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null, name: null })}
        onConfirm={confirmDelete}
        title="Delete Course"
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

