import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { DashboardLayout } from '../../components/layouts';
import { Card, Button, Input, Select, Modal, Table, Badge } from '../../components/ui';
import { 
  Users, 
  Plus, 
  Search,
  Trash2,
  Edit,
  BookOpen,
  UserPlus,
  Check
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const AdminEnrollment: React.FC = () => {
  const { students, subjects, courses, fetchStudents, fetchSubjects, studentSubjects, fetchStudentSubjects } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [enrolledSubjectIds, setEnrolledSubjectIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStudents();
    fetchSubjects();
    fetchStudentSubjects();
  }, []);

  const getStudentEnrolledSubjects = (studentId: string) => {
    return studentSubjects
      .filter(es => es.student_id === studentId)
      .map(es => es.subject);
  };

  const openEnrollModal = (student: any) => {
    setSelectedStudent(student);
    const enrolled = getStudentEnrolledSubjects(student.id)
      .map(s => s?.id)
      .filter((id): id is string => id !== undefined); // Filter out undefined values
    setEnrolledSubjectIds(enrolled);
    setIsEnrollModalOpen(true);
  };

  const handleEnrollSubjects = async () => {
    if (!selectedStudent) return;
    setLoading(true);

    try {
      // Get current enrolled subjects
      const currentEnrolled = studentSubjects
        .filter(es => es.student_id === selectedStudent.id)
        .map(es => es.subject_id);

      // Subjects to add
      const toAdd = enrolledSubjectIds.filter(id => !currentEnrolled.includes(id));
      
      // Subjects to remove
      const toRemove = currentEnrolled.filter(id => !enrolledSubjectIds.includes(id));

      // Add new enrollments
      for (const subjectId of toAdd) {
        await supabase.from('student_subjects').insert({
          student_id: selectedStudent.id,
          subject_id: subjectId
        });
      }

      // Remove unenrollments
      for (const subjectId of toRemove) {
        await supabase.from('student_subjects')
          .delete()
          .eq('student_id', selectedStudent.id)
          .eq('subject_id', subjectId);
      }

      await fetchStudentSubjects();
      setIsEnrollModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSubject = (subjectId: string) => {
    if (enrolledSubjectIds.includes(subjectId)) {
      setEnrolledSubjectIds(enrolledSubjectIds.filter(id => id !== subjectId));
    } else {
      setEnrolledSubjectIds([...enrolledSubjectIds, subjectId]);
    }
  };

  const getCourseName = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    return course?.name || 'Unknown';
  };

  const getFilteredSubjects = () => {
    let filtered = subjects;
    if (courseFilter !== 'all') {
      filtered = subjects.filter(s => s.course_id === courseFilter);
    }
    return filtered;
  };

  const filteredStudents = students.filter(student => {
    const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase());
    const matchesCourse = courseFilter === 'all' || student.course_id === courseFilter;
    return matchesSearch && matchesCourse;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Student Enrollment</h1>
            <p className="text-gray-400 mt-2">Assign subjects to students</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<Search size={18} />}
              />
            </div>
            <Select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Courses' },
                ...courses.map(c => ({ value: c.id, label: c.name }))
              ]}
            />
          </div>
        </Card>

        {/* Students Table */}
        <Card>
          <Table headers={['Student', 'Year Level', 'Section', 'Course', 'Enrolled Subjects', 'Actions']}>
            {filteredStudents.map(student => {
              const enrolled = getStudentEnrolledSubjects(student.id);
              return (
                <tr key={student.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-maroon-600 to-gold-500 flex items-center justify-center text-white font-semibold">
                        {student.first_name?.charAt(0)}
                      </div>
                      <span className="text-white font-medium">
                        {student.first_name} {student.last_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{student.grade_level}</td>
                  <td className="px-4 py-3 text-gray-300">{student.section}</td>
                  <td className="px-4 py-3 text-gray-300">
                    {student.course_id ? getCourseName(student.course_id) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {enrolled.length > 0 ? (
                        enrolled.slice(0, 3).map((subject: any) => (
                          subject && (
                            <Badge key={subject.id} variant="info">
                              {subject.name}
                            </Badge>
                          )
                        ))
                      ) : (
                        <span className="text-gray-400 text-sm">No subjects</span>
                      )}
                      {enrolled.length > 3 && (
                        <Badge variant="warning">+{enrolled.length - 3} more</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" onClick={() => openEnrollModal(student)}>
                      <UserPlus size={16} className="mr-1" />
                      Enroll
                    </Button>
                  </td>
                </tr>
              );
            })}
          </Table>
          {filteredStudents.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No students found
            </div>
          )}
        </Card>
      </div>

      {/* Enrollment Modal */}
      <Modal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        title={`Enroll Subjects - ${selectedStudent?.first_name} ${selectedStudent?.last_name}`}
      >
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            Select subjects to enroll this student in:
          </p>

          <div className="max-h-64 overflow-y-auto space-y-2">
            {getFilteredSubjects().map(subject => (
              <div
                key={subject.id}
                onClick={() => toggleSubject(subject.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  enrolledSubjectIds.includes(subject.id)
                    ? 'border-gold-500 bg-gold-500/10'
                    : 'border-maroon-800/50 hover:border-maroon-700'
                }`}
              >
                <div>
                  <p className="text-white font-medium">{subject.name}</p>
                  <p className="text-gray-400 text-sm">{getCourseName(subject.course_id)}</p>
                </div>
                {enrolledSubjectIds.includes(subject.id) && (
                  <Check className="text-gold-400" size={20} />
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsEnrollModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleEnrollSubjects} disabled={loading} className="flex-1">
              {loading ? 'Saving...' : 'Save Enrollment'}
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default AdminEnrollment;
