import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { DashboardLayout } from '../../components/layouts';
import { Card, Badge, Table } from '../../components/ui';
import { 
  BookOpen, 
  GraduationCap,
  User,
  Clock
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const StudentSubjects: React.FC = () => {
  const { user, subjects } = useStore();
  const [myEnrollments, setMyEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyEnrollments();
  }, [user, subjects]);

  const fetchMyEnrollments = async () => {
    if (!user) return;
    setLoading(true);

    // Get current student's record
    const { data: studentData } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (studentData) {
      const { data: enrollments } = await supabase
        .from('student_subjects')
        .select('*, subject:subjects(*, course:courses(*), teacher:users!subjects_teacher_id_fkey(*))')
        .eq('student_id', studentData.id);

      if (enrollments) setMyEnrollments(enrollments);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-white">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">My Subjects</h1>
          <p className="text-gray-400 mt-2">View your enrolled subjects</p>
        </div>

        {/* Subject Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {myEnrollments.map(enrollment => (
            <Card key={enrollment.id}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-300">
                  <BookOpen size={24} />
                </div>
                <Badge variant="info">
                  {enrollment.subject?.course?.name || 'No Course'}
                </Badge>
              </div>
              
              <h3 className="text-xl font-semibold text-white mb-2">
                {enrollment.subject?.name}
              </h3>

              <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                <div className="flex items-center gap-3 text-gray-300">
                  <User size={16} className="text-gray-400" />
                  <span>
                    {enrollment.subject?.teacher?.name || 'No Teacher Assigned'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-gray-300">
                  <Clock size={16} className="text-gray-400" />
                  <span>Enrolled: {new Date(enrollment.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {myEnrollments.length === 0 && (
          <Card>
            <div className="text-center py-12 text-gray-400">
              <GraduationCap size={48} className="mx-auto mb-4 opacity-50" />
              <p>You are not enrolled in any subjects yet</p>
              <p className="text-sm mt-2">Contact your administrator to enroll</p>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentSubjects;
