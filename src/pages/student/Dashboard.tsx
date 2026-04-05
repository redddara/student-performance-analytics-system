import { useState, useEffect } from 'react';
import { BookOpen, CheckCircle2, Pencil, Target } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageIntro } from '../../components/layouts/PageIntro';
import { GlassCard, Spinner } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, isPassing, calculateGWA } from '../../lib/supabase';

export default function StudentDashboard() {
  const { user } = useAuthStore();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [myGrades, setMyGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Get student record
      const { data: studentData } = await supabase
        .from('students')
        .select('*, course:courses(*)')
        .eq('user_id', user?.id)
        .single();

      if (!studentData) {
        setLoading(false);
        return;
      }

      // Get enrolled subjects
      const { data: studentSubjects } = await supabase
        .from('student_subjects')
        .select('*, subject:subjects(*, course:courses(*), teacher:users(*))')
        .eq('student_id', studentData.id);

      setMySubjects(studentSubjects || []);

      // Get grades
      const { data: gradesData } = await supabase
        .from('grades')
        .select('*')
        .eq('student_id', studentData.id);

      setMyGrades(gradesData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <DashboardLayout title="Dashboard"><Spinner size="lg" /></DashboardLayout>;
  }

  // Calculate GWA
  const passingGrades = myGrades.filter(g => isPassing(g.grade));
  const gwa = myGrades.length > 0 
    ? Math.round(calculateGWA(myGrades) * 100) / 100 
    : 0;

  return (
    <DashboardLayout title="Student Dashboard">
      <PageIntro
        title="Your academic snapshot"
        subtitle="Enrollment, grades recorded so far, and your general weighted average (GWA)."
      />
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#800000] to-[#a52a2a] flex items-center justify-center text-white">
              <BookOpen className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#800000]">{mySubjects.length}</p>
              <p className="text-sm text-gray-500">Enrolled Subjects</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#b8962e] flex items-center justify-center text-maroon-900">
              <Pencil className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#d4af37]">{myGrades.length}</p>
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
              <p className="text-2xl font-bold text-gold-600">{passingGrades.length}</p>
              <p className="text-sm text-gray-500">Passing</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-maroon-500 to-maroon-600 flex items-center justify-center text-white">
              <Target className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />
            </div>
            <div>
              <p className="text-2xl font-bold text-maroon-600">{gwa.toFixed(2)}</p>
              <p className="text-sm text-gray-500">GWA</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* My Subjects */}
      <GlassCard className="p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-[#800000] mb-4">My Subjects</h2>
        {mySubjects.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No subjects enrolled</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mySubjects.map(ss => (
              <div key={ss.id} className="p-4 glass-inset">
                <h3 className="font-semibold text-gray-800">{ss.subject?.name}</h3>
                <p className="text-sm text-gray-500">{ss.subject?.course?.name}</p>
                <p className="text-sm text-gray-500">{ss.subject?.year_level} - {ss.subject?.semester}</p>
                {ss.subject?.teacher && (
                  <p className="text-xs text-gray-400 mt-2 break-words">Teacher: {ss.subject.teacher.name || `${ss.subject.teacher.first_name} ${ss.subject.teacher.last_name}`}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </DashboardLayout>
  );
}