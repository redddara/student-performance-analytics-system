import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { DashboardLayout } from '../../components/layouts';
import { Card, Button, Input, Select, Modal, Table, Badge } from '../../components/ui';
import { 
  ClipboardList, 
  Plus, 
  Search,
  Trash2,
  Edit,
  X,
  User,
  BookOpen
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const AdminSubjects: React.FC = () => {
  const { subjects, courses, fetchSubjects, fetchCourses } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  
  const [newSubject, setNewSubject] = useState({
    name: '',
    courseId: '',
    teacherId: ''
  });

  const [editSubject, setEditSubject] = useState({
    name: '',
    courseId: '',
    teacherId: ''
  });

  useEffect(() => {
    fetchTeachers();
    fetchCourses();
  }, []);

  const fetchTeachers = async () => {
    const { data } = await supabase.from('users').select('*').eq('role', 'teacher');
    if (data) setTeachers(data);
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await supabase.from('subjects').insert({
        name: newSubject.name,
        course_id: newSubject.courseId,
        teacher_id: newSubject.teacherId || null
      });
      await fetchSubjects();
      setIsModalOpen(false);
      setNewSubject({ name: '', courseId: '', teacherId: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await supabase.from('subjects').update({
        name: editSubject.name,
        course_id: editSubject.courseId,
        teacher_id: editSubject.teacherId || null
      }).eq('id', selectedSubject.id);
      await fetchSubjects();
      setIsEditModalOpen(false);
      setSelectedSubject(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (subject: any) => {
    setSelectedSubject(subject);
    setEditSubject({
      name: subject.name,
      courseId: subject.course_id,
      teacherId: subject.teacher_id || ''
    });
    setIsEditModalOpen(true);
  };

  const handleDeleteSubject = async (subjectId: string) => {
    if (!confirm('Are you sure you want to delete this subject?')) return;
    await supabase.from('subjects').delete().eq('id', subjectId);
    fetchSubjects();
  };

  const filteredSubjects = subjects.filter(subject => {
    const matchesSearch = subject.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse = courseFilter === 'all' || subject.course_id === courseFilter;
    return matchesSearch && matchesCourse;
  });

  const getCourseName = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    return course?.name || 'No Course';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Subject Management</h1>
            <p className="text-gray-400 mt-2">Manage subjects and teacher assignments</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus size={18} className="mr-2" />
            Add Subject
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <Input
              placeholder="Search subjects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search size={18} />}
            />
          </Card>
          <Card>
            <Select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Courses' },
                ...courses.map(c => ({ value: c.id, label: c.name }))
              ]}
            />
          </Card>
        </div>

        <Card>
          <Table headers={['Subject Name', 'Course', 'Teacher', 'Actions']}>
            {filteredSubjects.map(subject => (
              <tr key={subject.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-300"> 
                      <ClipboardList size={18} />
                    </div>
                    <span className="text-white font-medium">{subject.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-300">
                  {getCourseName(subject.course_id)}
                </td>
                <td className="px-4 py-3">
                  {subject.teacher?.name ? (
                    <Badge variant="success">{subject.teacher.name}</Badge>
                  ) : (
                    <Badge variant="warning">Unassigned</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(subject)}
                      className="p-2 rounded-lg text-gold-400 hover:bg-gold-500/10 transition-colors"
                      title="Edit Subject"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteSubject(subject.id)}
                      className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete Subject"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          {filteredSubjects.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No subjects found. Create your first subject!
            </div>
          )}
        </Card>
      </div>

      {/* Add Subject Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add New Subject"
      >
        <form onSubmit={handleCreateSubject} className="space-y-4">
          <Input
            label="Subject Name"
            value={newSubject.name}
            onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
            placeholder="e.g., Mathematics"
            required
          />
          <Select
            label="Course"
            value={newSubject.courseId}
            onChange={(e) => setNewSubject({ ...newSubject, courseId: e.target.value })}
            options={[
              { value: '', label: 'Select Course' },
              ...courses.map(c => ({ value: c.id, label: c.name }))
            ]}
            required
          />
          <Select
            label="Assign Teacher (Optional)"
            value={newSubject.teacherId}
            onChange={(e) => setNewSubject({ ...newSubject, teacherId: e.target.value })}
            options={[
              { value: '', label: 'No Teacher Assigned' },
              ...teachers.map(t => ({ value: t.id, label: t.name || t.email }))
            ]}
          />
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Creating...' : 'Create Subject'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Subject Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setSelectedSubject(null); }}
        title="Edit Subject"
      >
        <form onSubmit={handleUpdateSubject} className="space-y-4">
          <Input
            label="Subject Name"
            value={editSubject.name}
            onChange={(e) => setEditSubject({ ...editSubject, name: e.target.value })}
            required
          />
          <Select
            label="Course"
            value={editSubject.courseId}
            onChange={(e) => setEditSubject({ ...editSubject, courseId: e.target.value })}
            options={[
              { value: '', label: 'Select Course' },
              ...courses.map(c => ({ value: c.id, label: c.name }))
            ]}
            required
          />
          <Select
            label="Assign Teacher (Optional)"
            value={editSubject.teacherId}
            onChange={(e) => setEditSubject({ ...editSubject, teacherId: e.target.value })}
            options={[
              { value: '', label: 'No Teacher Assigned' },
              ...teachers.map(t => ({ value: t.id, label: t.name || t.email }))
            ]}
          />
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setIsEditModalOpen(false); setSelectedSubject(null); }} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
};

export default AdminSubjects;
