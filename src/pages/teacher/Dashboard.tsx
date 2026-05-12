import { useState, useEffect, useCallback } from 'react';
import { useSupabaseLiveReload } from '../../lib/useSupabaseLiveReload';
import { CheckCircle2, GraduationCap, UserPen, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Button, PageSkeletonLoader } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, isPassing, calculateGWA } from '../../lib/supabase';

export default function TeacherDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [grades, setGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [myStudents, setMyStudents] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    try {
      // Get subjects assigned to this teacher
      const { data: teacherSubjects } = await supabase
        .from('subjects')
        .select('*, course:courses(*)')
        .eq('teacher_id', user?.id);

      setMySubjects(teacherSubjects || []);

      // Get unique students in teacher's subjects
      if (teacherSubjects && teacherSubjects.length > 0) {
        const subjectIds = teacherSubjects.map((s: any) => s.id);
        const { data: gradesData } = await supabase
          .from('grades')
          .select('*')
          .in('subject_id', subjectIds);
        setGrades(gradesData || []);

        const { data: studentSubjects } = await supabase
          .from('student_subjects')
          .select('student_id')
          .in('subject_id', subjectIds);
        
        const uniqueStudentIds = [...new Set((studentSubjects || []).map((ss: any) => ss.student_id))];
        setMyStudents(uniqueStudentIds);
      } else {
        setGrades([]);
        setMyStudents([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useSupabaseLiveReload(loadData, user?.id ? `live:teacher-dashboard:${user.id}` : null, [
    'grades',
    'student_subjects',
    'subjects',
    'students',
    'courses',
  ]);

  if (loading) {
    return <DashboardLayout title="Dashboard"><PageSkeletonLoader /></DashboardLayout>;
  }

  // Calculate stats - only teacher's subjects grades
  const mySubjectIds = mySubjects.map((s: any) => s.id);
  const myGrades = grades.filter((g: any) => mySubjectIds.includes(g.subject_id));
  const totalGrades = myGrades.length;
  const studentGwa = myStudents.map((studentId: any) => {
    const studentGrades = myGrades.filter((g: any) => g.student_id === studentId);
    return {
      studentId,
      gwa: studentGrades.length > 0 ? calculateGWA(studentGrades) : 0,
      hasGrades: studentGrades.length > 0,
    };
  }).filter((entry) => entry.hasGrades);
  const passingStudents = studentGwa.filter((entry) => isPassing(entry.gwa)).length;
  const passRate = studentGwa.length > 0 ? Math.round((passingStudents / studentGwa.length) * 100) : 0;

  return (
    <DashboardLayout title="Teacher Dashboard">
      
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#800000] to-[#a52a2a] flex items-center justify-center text-white">
              <GraduationCap className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#800000]">{mySubjects.length}</p>
              <p className="text-sm text-gray-500">My Subjects</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#b8962e] flex items-center justify-center text-maroon-900">
              <UserRound className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#d4af37]">{myStudents.length}</p>
              <p className="text-sm text-gray-500">Students</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-maroon-500 to-maroon-600 flex items-center justify-center text-white">
              <UserPen className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />
            </div>
            <div>
              <p className="text-2xl font-bold text-maroon-600">{totalGrades}</p>
              <p className="text-sm text-gray-500">Total Grades</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center text-white">
              <CheckCircle2 className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />
            </div>
            <div>
              <p className="text-2xl font-bold text-gold-600">{passRate}%</p>
              <p className="text-sm text-gray-500">Pass Rate</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* My Subjects */}
      <GlassCard className="p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-[#800000] mb-4">My Assigned Subjects</h2>
        {mySubjects.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No subjects assigned yet</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mySubjects.map(subject => (
              <div key={subject.id} className="p-4 glass-inset">
                <h3 className="font-semibold text-gray-800">{subject.name}</h3>
                <p className="text-sm text-gray-500">{subject.course?.name} - {subject.year_level} - {subject.semester}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full sm:w-auto"
                  onClick={() => {
                    navigate(`/teacher/grades?subject=${subject.id}`);
                  }}
                >
                  <UserPen className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                  View Grades
                  <span className="text-sm font-semibold opacity-90" aria-hidden>
                    →
                  </span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </DashboardLayout>
  );
}

