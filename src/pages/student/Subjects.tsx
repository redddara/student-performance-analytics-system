import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Spinner } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase } from '../../lib/supabase';

export default function StudentSubjectsPage() {
  const { user } = useAuthStore();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: studentData } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (!studentData) return;

      const { data: studentSubjects } = await supabase
        .from('student_subjects')
        .select('*, subject:subjects(*, course:courses(*), teacher:users(*))')
        .eq('student_id', studentData.id);

      setMySubjects(studentSubjects || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <DashboardLayout title="My Subjects"><Spinner size="lg" /></DashboardLayout>;
  }

  return (
    <DashboardLayout title="My Subjects">
      <GlassCard className="p-6">
        {mySubjects.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No subjects enrolled</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mySubjects.map(ss => (
              <div key={ss.id} className="p-6 rounded-xl bg-white/30 border border-white/40">
                <h3 className="text-lg font-semibold text-[#800000] mb-2">{ss.subject?.name}</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <p><span className="font-medium">Course:</span> {ss.subject?.course?.name}</p>
                  <p><span className="font-medium">Year Level:</span> {ss.subject?.year_level}</p>
                  <p><span className="font-medium">Semester:</span> {ss.subject?.semester}</p>
                  {ss.subject?.teacher && (
                    <p><span className="font-medium">Teacher:</span> {ss.subject.teacher.name || `${ss.subject.teacher.first_name} ${ss.subject.teacher.last_name}`}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </DashboardLayout>
  );
}