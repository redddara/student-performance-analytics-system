import React, { useState } from 'react';
import { useStore } from '../../store';
import { DashboardLayout } from '../../components/layouts';
import { Card, Button, Input, Modal, Table, Badge } from '../../components/ui';
import { 
  BookOpen, 
  Plus, 
  Search,
  Trash2,
  Edit,
  X,
  GraduationCap
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const AdminCourses: React.FC = () => {
  const { courses, fetchCourses } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [editCourseName, setEditCourseName] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await supabase.from('courses').insert({ name: newCourseName });
      await fetchCourses();
      setIsModalOpen(false);
      setNewCourseName('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await supabase.from('courses').update({ name: editCourseName }).eq('id', selectedCourse.id);
      await fetchCourses();
      setIsEditModalOpen(false);
      setSelectedCourse(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (course: any) => {
    setSelectedCourse(course);
    setEditCourseName(course.name);
    setIsEditModalOpen(true);
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this course?')) return;
    await supabase.from('courses').delete().eq('id', courseId);
    fetchCourses();
  };

  const filteredCourses = courses.filter(course => 
    course.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Course Management</h1>
            <p className="text-gray-400 mt-2">Manage academic courses</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus size={18} className="mr-2" />
            Add Course
          </Button>
        </div>

        <Card>
          <Input
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search size={18} />}
          />
        </Card>

        <Card>
          <Table headers={['Course Name', 'Created Date', 'Subjects', 'Actions']}>
            {filteredCourses.map(course => {
              const subjectCount = useStore.getState().subjects.filter(s => s.course_id === course.id).length;
              return (
                <tr key={course.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-300">
                        <BookOpen size={18} />
                      </div>
                      <span className="text-white font-medium">{course.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(course.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="info">{subjectCount} subjects</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(course)}
                        className="p-2 rounded-lg text-gold-400 hover:bg-gold-500/10 transition-colors"
                        title="Edit Course"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteCourse(course.id)}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete Course"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
          {filteredCourses.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No courses found. Create your first course!
            </div>
          )}
        </Card>
      </div>

      {/* Add Course Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add New Course"
      >
        <form onSubmit={handleCreateCourse} className="space-y-4">
          <Input
            label="Course Name"
            value={newCourseName}
            onChange={(e) => setNewCourseName(e.target.value)}
            placeholder="e.g., Bachelor of Science in Information Technology"
            required
          />
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Creating...' : 'Create Course'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Course Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setSelectedCourse(null); }}
        title="Edit Course"
      >
        <form onSubmit={handleUpdateCourse} className="space-y-4">
          <Input
            label="Course Name"
            value={editCourseName}
            onChange={(e) => setEditCourseName(e.target.value)}
            required
          />
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setIsEditModalOpen(false); setSelectedCourse(null); }} className="flex-1">
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

export default AdminCourses;
