import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { DashboardLayout } from '../../components/layouts';
import { Card, Button, Input, Select, Modal, Table, Badge } from '../../components/ui';
import { 
  ClipboardList, 
  Plus, 
  Search,
  Edit,
  Save,
  X,
  User,
  BookOpen
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const TeacherGrades: React.FC = () => {
  const { user, subjects, grades, students, getTeacherSubjects, fetchGrades } = useStore();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Grade entry form
  const [gradeForm, setGradeForm] = useState({
    studentId: '',
    semester: '1',
    quarter: '1',
    grade: '',
    remarks: ''
  });

  useEffect(() => {
    if (user) {
      const teacherSubjects = getTeacherSubjects(user.id);
      setMySubjects(teacherSubjects);
      if (teacherSubjects.length > 0) {
        setSelectedSubject(teacherSubjects[0].id);
      }
    }
  }, [user, subjects]);

  // Get enrolled students for selected subject
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);

  useEffect(() => {
    if (selectedSubject) {
      fetchEnrolledStudents();
    }
  }, [selectedSubject]);

  const fetchEnrolledStudents = async () => {
    const { data } = await supabase
      .from('student_subjects')
      .select('*, student:students(*), subject:subjects(*)')
      .eq('subject_id', selectedSubject);
    
    if (data) setEnrolledStudents(data);
  };

  // Get grades for selected subject
  const subjectGrades = grades.filter(g => g.subject_id === selectedSubject);

  const getStudentGrade = (studentId: string) => {
    const studentGrades = subjectGrades.filter(g => g.student_id === studentId);
    if (studentGrades.length === 0) return null;
    return studentGrades[studentGrades.length - 1];
  };

  const handleEncodeGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await supabase.from('grades').insert({
        student_id: gradeForm.studentId,
        subject_id: selectedSubject,
        semester: parseInt(gradeForm.semester),
        quarter: parseInt(gradeForm.quarter),
        grade: parseFloat(gradeForm.grade),
        remarks: gradeForm.remarks || null
      });

      await fetchGrades();
      setIsModalOpen(false);
      setGradeForm({
        studentId: '',
        semester: '1',
        quarter: '1',
        grade: '',
        remarks: ''
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openGradeModal = (studentId: string) => {
    setGradeForm({ ...gradeForm, studentId });
    setIsModalOpen(true);
  };

  const filteredStudents = enrolledStudents.filter(es => {
    const student = es.student;
    if (!student) return false;
    const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  const getGradeBadge = (grade: number | null) => {
    if (grade === null) return <Badge variant="warning">No Grade</Badge>;
    if (grade >= 90) return <Badge variant="success">Excellent</Badge>;
    if (grade >= 80) return <Badge variant="info">Very Good</Badge>;
    if (grade >= 75) return <Badge variant="success">Good</Badge>;
    if (grade >= 70) return <Badge variant="warning">Fair</Badge>;
    return <Badge variant="danger">Poor</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Grade Entry</h1>
            <p className="text-gray-400 mt-2">Encode and manage student grades</p>
          </div>
        </div>

        {/* Subject Selection */}
        <Card>
          <Select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            options={[
              { value: '', label: 'Select Subject' },
              ...mySubjects.map(s => ({ value: s.id, label: s.name }))
            ]}
          />
        </Card>

        {/* Students List */}
        {selectedSubject ? (
          <Card>
            <div className="mb-4">
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<Search size={18} />}
              />
            </div>

            <Table headers={['Student', 'Grade', 'Quarter', 'Semester', 'Remarks', 'Actions']}>
              {filteredStudents.map(es => {
                const student = es.student;
                const grade = getStudentGrade(student?.id);
                
                return (
                  <tr key={es.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                          {student?.first_name?.charAt(0)}
                        </div>
                        <span className="text-white font-medium">
                          {student?.first_name} {student?.last_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xl font-bold text-white">
                        {grade ? grade.grade.toString() : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {grade ? `Q${grade.quarter}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {grade ? `Sem ${grade.semester}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {grade?.remarks || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <Button 
                        size="sm" 
                        onClick={() => openGradeModal(student?.id)}
                      >
                        {grade ? 'Update' : 'Add'} Grade
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </Table>

            {filteredStudents.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                {enrolledStudents.length === 0 
                  ? 'No students enrolled in this subject'
                  : 'No students found'
                }
              </div>
            )}
          </Card>
        ) : (
          <Card>
            <div className="text-center py-12 text-gray-400">
              <BookOpen size={48} className="mx-auto mb-4 opacity-50" />
              <p>Select a subject to manage grades</p>
            </div>
          </Card>
        )}
      </div>

      {/* Grade Entry Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Encode Grade"
      >
        <form onSubmit={handleEncodeGrade} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Semester"
              value={gradeForm.semester}
              onChange={(e) => setGradeForm({ ...gradeForm, semester: e.target.value })}
              options={[
                { value: '1', label: 'First Semester' },
                { value: '2', label: 'Second Semester' }
              ]}
            />
            <Select
              label="Quarter"
              value={gradeForm.quarter}
              onChange={(e) => setGradeForm({ ...gradeForm, quarter: e.target.value })}
              options={[
                { value: '1', label: 'First Quarter' },
                { value: '2', label: 'Second Quarter' },
                { value: '3', label: 'Third Quarter' },
                { value: '4', label: 'Fourth Quarter' }
              ]}
            />
          </div>
          
          <Input
            label="Grade (0-100)"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={gradeForm.grade}
            onChange={(e) => setGradeForm({ ...gradeForm, grade: e.target.value })}
            placeholder="Enter grade"
            required
          />

          <Input
            label="Remarks (Optional)"
            value={gradeForm.remarks}
            onChange={(e) => setGradeForm({ ...gradeForm, remarks: e.target.value })}
            placeholder="e.g., Excellent performance"
          />

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Saving...' : 'Save Grade'}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
};

export default TeacherGrades;
