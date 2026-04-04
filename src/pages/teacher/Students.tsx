import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Spinner, Badge, Table } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase } from '../../lib/supabase';

export default function TeacherStudentsPage() {
  const { user } = useAuthStore();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Get teacher's subjects
      const { data: teacherSubjects } = await supabase
        .from('subjects')
        .select('*, course:courses(*)')
        .eq('teacher_id', user?.id);

      setMySubjects(teacherSubjects || []);

      // Get student subjects for these subjects
      const subjectIds = (teacherSubjects || []).map((s: any) => s.id);
      
      if (subjectIds.length > 0) {
        const { data: studentSubjects } = await supabase
          .from('student_subjects')
          .select('*, student:students(*, course:courses(*), user:users(*))')
          .in('subject_id', subjectIds);

        // Get unique students
        const uniqueStudents = new Map();
        (studentSubjects || []).forEach((ss: any) => {
          if (!uniqueStudents.has(ss.student.id)) {
            uniqueStudents.set(ss.student.id, {
              ...ss.student,
              subjects: [],
            });
          }
          // Add subject to student's subjects
          const student = uniqueStudents.get(ss.student.id);
          const subject = teacherSubjects?.find((s: any) => s.id === ss.subject_id);
          if (subject && !student.subjects.find((sub: any) => sub.id === subject.id)) {
            student.subjects.push(subject);
          }
        });

        setStudents(Array.from(uniqueStudents.values()));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <DashboardLayout title="Students"><Spinner size="lg" /></DashboardLayout>;
  }

  return (
    <DashboardLayout title="My Students">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#800000] to-[#a52a2a] flex items-center justify-center">
              <i className="hgi-stroke hgi-student text-white text-xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-[#800000]">{students.length}</p>
              <p className="text-sm text-gray-500">Total Students</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#b8962e] flex items-center justify-center">
              <i className="hgi-stroke hgi-school-tie text-white text-xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-[#d4af37]">{mySubjects.length}</p>
              <p className="text-sm text-gray-500">My Subjects</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <i className="hgi-stroke hgi-book-user text-white text-xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {new Set(students.map((s: any) => s.course_id)).size}
              </p>
              <p className="text-sm text-gray-500">Courses</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Students Table */}
      <GlassCard className="p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-[#800000] mb-4">Enrolled Students</h2>
        {students.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No students enrolled in your subjects yet</p>
        ) : (
          <Table 
            headers={['Name', 'Course', 'Year', 'Section', 'Enrolled Subjects']}
          >
            {students.map(student => (
              <tr key={student.id} className="hover:bg-white/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#800000] to-[#d4af37] flex items-center justify-center text-white text-sm font-bold">
                      {student.first_name?.[0] || 'S'}
                    </div>
                    <span className="font-medium text-gray-800">
                      {student.first_name} {student.last_name}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{student.course?.name || '-'}</td>
                <td className="px-4 py-3 text-gray-600">{student.grade_level || '-'}</td>
                <td className="px-4 py-3 text-gray-600">{student.section || '-'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {student.subjects?.slice(0, 3).map((sub: any) => (
                      <Badge key={sub.id} variant="info">{sub.name}</Badge>
                    ))}
                    {student.subjects?.length > 3 && (
                      <Badge variant="warning">+{student.subjects.length - 3} more</Badge>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </GlassCard>
    </DashboardLayout>
  );
}