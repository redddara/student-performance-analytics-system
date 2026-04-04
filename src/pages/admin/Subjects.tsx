import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Button, Input, Table, Modal, Spinner, Select, ConfirmModal } from '../../components/ui';
import { useDataStore } from '../../store';
import { supabase } from '../../lib/supabase';

export default function AdminSubjectsPage() {
  const { subjects, courses, setSubjects, setCourses } = useDataStore();
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean; id: string | null; name: string | null}>({ isOpen: false, id: null, name: null });
  
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
    
    const data = {
      name: formData.name,
      course_id: formData.course_id,
      year_level: formData.year_level,
      semester: formData.semester,
      teacher_id: formData.teacher_id || null,
    };
    
    if (editingSubject) {
      await supabase.from('subjects').update(data).eq('id', editingSubject.id);
    } else {
      await supabase.from('subjects').insert(data);
    }
    
    setShowModal(false);
    setFormData({ name: '', course_id: '', year_level: '1st', semester: '1st Sem', teacher_id: '' });
    setEditingSubject(null);
    loadData();
  };

  const handleEdit = (subject: any) => {
    setEditingSubject(subject);
    setFormData({
      name: subject.name,
      course_id: subject.course_id,
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
    if (deleteConfirm.id) {
      await supabase.from('subjects').delete().eq('id', deleteConfirm.id);
      loadData();
      setDeleteConfirm({ isOpen: false, id: null, name: null });
    }
  };

  if (loading) {
    return <DashboardLayout title="Subjects"><Spinner size="lg" /></DashboardLayout>;
  }

  return (
    <DashboardLayout title="Subject Management">
      <Button onClick={() => setShowModal(true)} className="mb-6">
        <i className="hgi-stroke hgi-plus mr-1 text-lg"/>Add Subject
      </Button>
      
      <GlassCard className="p-6">
        <Table headers={['Subject Name', 'Course', 'Year Level', 'Semester', 'Teacher', 'Actions']} className="maroon-glass-card">
          {subjects.map(subject => (
            <tr key={subject.id} className="hover:bg-white/20">
              <td className="px-4 py-3 font-medium text-gray-800">{subject.name}</td>
              <td className="px-4 py-3 text-gray-600">{subject.course?.name || '-'}</td>
              <td className="px-4 py-3 text-gray-600">{subject.year_level || '-'}</td>
              <td className="px-4 py-3 text-gray-600">{subject.semester || '-'}</td>
              <td className="px-4 py-3 text-gray-600">
                {subject.teacher ? `${subject.teacher.first_name || ''} ${subject.teacher.last_name || ''}`.trim() || subject.teacher.name || '-' : '-'}
              </td>
              <td className="px-4 py-3">
                <Button variant="ghost" size="sm" onClick={() => handleEdit(subject)}>Edit</Button>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(subject.id, subject.name)}>Delete</Button>
              </td>
            </tr>
          ))}
        </Table>
        {subjects.length === 0 && <p className="text-center text-gray-500 py-8">No subjects yet</p>}
      </GlassCard>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setFormData({ name: '', course_id: '', year_level: '1st', semester: '1st Sem', teacher_id: '' }); setEditingSubject(null); }} title={editingSubject ? 'Edit Subject' : 'Add Subject'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Subject Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
          <Select label="Course" value={formData.course_id} onChange={e => setFormData({ ...formData, course_id: e.target.value })} options={courses.map(c => ({ value: c.id, label: c.name }))} required />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Year Level" value={formData.year_level} onChange={e => setFormData({ ...formData, year_level: e.target.value })} options={[{ value: '1st', label: '1st Year' }, { value: '2nd', label: '2nd Year' }, { value: '3rd', label: '3rd Year' }, { value: '4th', label: '4th Year' }]} />
            <Select label="Semester" value={formData.semester} onChange={e => setFormData({ ...formData, semester: e.target.value })} options={[{ value: '1st Sem', label: '1st Sem' }, { value: '2nd Sem', label: '2nd Sem' }]} />
          </div>
          <Select label="Teacher (Optional)" value={formData.teacher_id} onChange={e => setFormData({ ...formData, teacher_id: e.target.value })} options={[{ value: '', label: 'No Teacher' }, ...teachers.map(t => ({ value: t.id, label: t.name || `${t.first_name} ${t.last_name}` || t.username }))]} />
          <div className="flex gap-4 pt-4">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => { setShowModal(false); setFormData({ name: '', course_id: '', year_level: '1st', semester: '1st Sem', teacher_id: '' }); setEditingSubject(null); }}>Cancel</Button>
            <Button type="submit" className="flex-1">{editingSubject ? 'Update' : 'Create'}</Button>
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
    </DashboardLayout>
  );
}

