import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Button, Input, Table, Modal, Spinner, ConfirmModal } from '../../components/ui';
import { useDataStore } from '../../store';
import { supabase } from '../../lib/supabase';

export default function AdminCoursesPage() {
  const { courses, setCourses } = useDataStore();
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [courseName, setCourseName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean; id: string | null; name: string | null}>({ isOpen: false, id: null, name: null });

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
    
    if (editingCourse) {
      await supabase.from('courses').update({ name: courseName }).eq('id', editingCourse.id);
    } else {
      await supabase.from('courses').insert({ name: courseName });
    }
    
    setShowModal(false);
    setCourseName('');
    setEditingCourse(null);
    loadCourses();
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
    if (deleteConfirm.id) {
      await supabase.from('courses').delete().eq('id', deleteConfirm.id);
      loadCourses();
      setDeleteConfirm({ isOpen: false, id: null, name: null });
    }
  };

  if (loading) {
    return <DashboardLayout title="Courses"><Spinner size="lg" /></DashboardLayout>;
  }

  return (
    <DashboardLayout title="Course Management">
      <Button onClick={() => setShowModal(true)} className="mb-6">➕ Add Course</Button>
      
      <GlassCard className="p-6">
        <Table headers={['Course Name', 'Actions']}>
          {courses.map(course => (
            <tr key={course.id} className="hover:bg-white/20">
              <td className="px-4 py-3 font-medium text-gray-800">{course.name}</td>
              <td className="px-4 py-3">
                <Button variant="ghost" size="sm" onClick={() => handleEdit(course)}>Edit</Button>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(course.id, course.name)}>Delete</Button>
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
            <Button type="button" variant="secondary" className="flex-1" onClick={() => { setShowModal(false); setCourseName(''); setEditingCourse(null); }}>Cancel</Button>
            <Button type="submit" className="flex-1">{editingCourse ? 'Update' : 'Create'}</Button>
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
    </DashboardLayout>
  );
}