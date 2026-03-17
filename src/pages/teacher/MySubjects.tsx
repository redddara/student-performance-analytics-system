import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { DashboardLayout } from '../../components/layouts';
import { Card, Badge, Button, Table, Select } from '../../components/ui';
import { 
  BookOpen, 
  Users, 
  GraduationCap,
  ClipboardList
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const TeacherSubjects: React.FC = () => {
  const { user, subjects, grades, students, getTeacherSubjects } = useStore();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      const teacherSubjects = getTeacherSubjects(user.id);
      setMySubjects(teacherSubjects);
    }
  }, [user, subjects]);

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

  const getSubjectStats = (subjectId: string) => {
    const subjectGrades = grades.filter(g => g.subject_id === subjectId);
    const studentCount = new Set(subjectGrades.map(g => g.student_id)).size;
    const avgGrade = subjectGrades.length > 0
      ? subjectGrades.reduce((sum, g) => sum + Number(g.grade), 0) / subjectGrades.length
      : 0;
    const passingCount = subjectGrades.filter(g => Number(g.grade) >= 75).length;
    const passingRate = subjectGrades.length > 0 ? (passingCount / subjectGrades.length) * 100 : 0;
    
    return { studentCount, avgGrade, passingRate };
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">My Subjects</h1>
          <p className="text-gray-400 mt-2">View and manage your assigned subjects</p>
        </div>

        {/* Subject Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mySubjects.map(subject => {
            const stats = getSubjectStats(subject.id);
            return (
              <Card 
                key={subject.id}
                className={`cursor-pointer transition-all ${
                  selectedSubject === subject.id 
                    ? 'ring-2 ring-indigo-500 border-indigo-500' 
                    : 'hover:ring-1 hover:ring-white/30'
                }`}
                onClick={() => setSelectedSubject(subject.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-300">
                    <BookOpen size={24} />
                  </div>
                  <Badge variant={subject.course?.name ? 'info' : 'warning'}>
                    {subject.course?.name || 'No Course'}
                  </Badge>
                </div>
                
                <h3 className="text-xl font-semibold text-white mb-2">{subject.name}</h3>
                
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/10">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{stats.studentCount}</p>
                    <p className="text-xs text-gray-400">Students</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{stats.avgGrade.toFixed(1)}</p>
                    <p className="text-xs text-gray-400">Avg Grade</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-400">{stats.passingRate.toFixed(0)}%</p>
                    <p className="text-xs text-gray-400">Passing</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {mySubjects.length === 0 && (
          <Card>
            <div className="text-center py-12 text-gray-400">
              <ClipboardList size={48} className="mx-auto mb-4 opacity-50" />
              <p>No subjects assigned to you yet</p>
            </div>
          </Card>
        )}

        {/* Enrolled Students Table */}
        {selectedSubject && (
          <Card>
            <h3 className="text-xl font-semibold text-white mb-4">
              Enrolled Students - {mySubjects.find(s => s.id === selectedSubject)?.name}
            </h3>
            
            {enrolledStudents.length > 0 ? (
              <Table headers={['Student', 'Grade Level', 'Section', 'Actions']}>
                {enrolledStudents.map(es => (
                  <tr key={es.id} className="hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                          {es.student?.first_name?.charAt(0)}
                        </div>
                        <span className="text-white font-medium">
                          {es.student?.first_name} {es.student?.last_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      Grade {es.student?.grade_level}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {es.student?.section || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="secondary">
                        View Grades
                      </Button>
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-400">
                No students enrolled in this subject
              </div>
            )}
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TeacherSubjects;
