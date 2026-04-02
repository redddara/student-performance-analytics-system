import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Button, Select, Table, Spinner, Badge } from '../../components/ui';
import { useAuthStore, useDataStore } from '../../store';
import { supabase, isPassing } from '../../lib/supabase';

export default function TeacherDashboard() {
  const { user } = useAuthStore();
  const { subjects, grades } = useDataStore();
  const [loading, setLoading] = useState(true);
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [myStudents, setMyStudents] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Get subjects assigned to this teacher
      const { data: teacherSubjects } = await supabase
        .from('subjects')
        .select('*, course:courses(*)')
        .eq('teacher_id', user?.id);

      setMySubjects(teacherSubjects || []);

      // Get grades
      const { data: gradesData } = await supabase.from('grades').select('*');
      useDataStore.getState().setGrades(gradesData || []);

      // Get unique students in teacher's subjects
      if (teacherSubjects && teacherSubjects.length > 0) {
        const subjectIds = teacherSubjects.map((s: any) => s.id);
        const { data: studentSubjects } = await supabase
          .from('student_subjects')
          .select('student_id')
          .in('subject_id', subjectIds);
        
        const uniqueStudentIds = [...new Set((studentSubjects || []).map((ss: any) => ss.student_id))];
        setMyStudents(uniqueStudentIds);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <DashboardLayout title="Dashboard"><Spinner size="lg" /></DashboardLayout>;
  }

  // Calculate stats - only teacher's subjects grades
  const mySubjectIds = mySubjects.map((s: any) => s.id);
  const myGrades = grades.filter((g: any) => mySubjectIds.includes(g.subject_id));
  const totalGrades = myGrades.length;
  const passingGrades = myGrades.filter((g: any) => isPassing(g.grade)).length;
  const passRate = totalGrades > 0 ? Math.round((passingGrades / totalGrades) * 100) : 0;

  return (
    <DashboardLayout title="Teacher Dashboard">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <GlassCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#800000] to-[#a52a2a] flex items-center justify-center">
              <i className="hgi-stroke hgi-school-tie text-white text-xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-[#800000]">{mySubjects.length}</p>
              <p className="text-sm text-gray-500">My Subjects</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#b8962e] flex items-center justify-center">
              <i className="hgi-stroke hgi-student text-white text-xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-[#d4af37]">{myStudents.length}</p>
              <p className="text-sm text-gray-500">Students</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <i className="hgi-stroke hgi-edit-user-02 text-white text-xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{totalGrades}</p>
              <p className="text-sm text-gray-500">Total Grades</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
              <i className="hgi-stroke hgi-checkmark-circle text-white text-xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{passRate}%</p>
              <p className="text-sm text-gray-500">Pass Rate</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* My Subjects */}
      <GlassCard className="p-6">
        <h2 className="text-xl font-semibold text-[#800000] mb-4">My Assigned Subjects</h2>
        {mySubjects.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No subjects assigned yet</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mySubjects.map(subject => (
              <div key={subject.id} className="p-4 rounded-xl bg-white/30 border border-white/40">
                <h3 className="font-semibold text-gray-800">{subject.name}</h3>
                <p className="text-sm text-gray-500">{subject.course?.name} - {subject.year_level} - {subject.semester}</p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => window.location.href = `/teacher/subjects?id=${subject.id}`}
                >
                  View Grades →
                </Button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </DashboardLayout>
  );
}