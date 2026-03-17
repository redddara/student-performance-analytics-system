import React, { useState } from 'react';
import { useStore } from '../../store';
import { DashboardLayout } from '../../components/layouts';
import { Card, Button, Input, Select, Modal, Table, Badge } from '../../components/ui';
import { 
  BookOpen, 
  Plus, 
  Search,
  Trash2,
  Edit,
  X,
  GraduationCap
} from 'lucide-react';

const AdminCourses: React.FC = () => {
  const { courses, createCourse, fetchCourses } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await createCourse(newCourseName);
      setIsModalOpen(false);
      setNewCourseName('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this course?')) return;
    await supabase.from('courses').delete().eq('id', courseId);
    fetchCourses();
  };

  const filteredCourses = courses.filter(course => 
    course.name.toLowerCase().includes(searchQuery.toLowerCase())
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
                    <button
                      onClick={() => handleDeleteCourse(course.id)}
                      className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </Table>
          {filteredCourses.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No courses found
            </div>
          )}
        </Card>
      </div>

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
            placeholder="e.g., Bachelor of Science in Computer Science"
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
    </DashboardLayout>
  );
};

export default AdminCourses;
