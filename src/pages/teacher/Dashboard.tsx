import { useState, useEffect, useCallback } from 'react';
import { useSupabaseLiveReload } from '../../lib/useSupabaseLiveReload';
import { CheckCircle2, GraduationCap, UserPen, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Button, PageSkeletonLoader } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase } from '../../lib/supabase';
import { computeStudentGwaPassRate, fetchActiveSchoolYear } from '../../lib/analyticsData';
import {
  buildTeacherDeadlineNotifications,
  fetchGradingPeriodDeadlines,
} from '../../lib/gradingPeriodDeadlines';

export default function TeacherDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [grades, setGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [myStudents, setMyStudents] = useState<string[]>([]);
  const [activeSchoolYearName, setActiveSchoolYearName] = useState('');
  const [deadlineReminders, setDeadlineReminders] = useState<
    ReturnType<typeof buildTeacherDeadlineNotifications>
  >([]);

  const loadData = useCallback(async () => {
    try {
      const activeSy = await fetchActiveSchoolYear();
      setActiveSchoolYearName(activeSy?.name || '');
      if (activeSy?.id) {
        try {
          const deadlines = await fetchGradingPeriodDeadlines(activeSy.id);
          setDeadlineReminders(buildTeacherDeadlineNotifications(deadlines));
        } catch {
          setDeadlineReminders([]);
        }
      } else {
        setDeadlineReminders([]);
      }

      // Get subjects assigned to this teacher
      const { data: teacherSubjects } = await supabase
        .from('subjects')
        .select('*, course:courses(*)')
        .eq('teacher_id', user?.id);

      setMySubjects(teacherSubjects || []);

      // Get unique students in teacher's subjects
      if (teacherSubjects && teacherSubjects.length > 0) {
        const subjectIds = teacherSubjects.map((s: any) => s.id);
        let gradesQuery = supabase.from('grades').select('*').in('subject_id', subjectIds);
        if (activeSy?.id) gradesQuery = gradesQuery.eq('school_year_id', activeSy.id);
        const { data: gradesData } = await gradesQuery;
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
    'school_years',
    'grading_period_deadlines',
  ]);

  if (loading) {
    return <DashboardLayout title="Dashboard"><PageSkeletonLoader /></DashboardLayout>;
  }

  const mySubjectIds = mySubjects.map((s: any) => s.id);
  const myGrades = grades.filter((g: any) => mySubjectIds.includes(g.subject_id));
  const { passRate } = computeStudentGwaPassRate(myStudents, myGrades);

  return (
    <DashboardLayout title="Teacher Dashboard">
      {activeSchoolYearName && (
        <p className="mb-3 text-sm text-gray-600">
          Active School Year: <span className="font-semibold text-[#800000]">{activeSchoolYearName}</span>
          {' '}(grades and passing rate use this year only)
        </p>
      )}

      {deadlineReminders.length > 0 && (
        <GlassCard variant="plain" className="mb-6 border-amber-200/80 bg-amber-50/90 p-4 sm:p-5">
          <h2 className="mb-2 text-lg font-semibold text-[#800000]">Grade submission deadlines</h2>
          <p className="mb-3 text-sm text-gray-700">
            Submit grades before each deadline. After the deadline, that period locks automatically.
          </p>
          <ul className="space-y-2">
            {deadlineReminders.map((item) => (
              <li
                key={item.id}
                className={`flex flex-wrap items-start justify-between gap-2 rounded-xl border px-3 py-2 text-sm ${
                  item.kind === 'passed'
                    ? 'border-red-200 bg-red-50/80'
                    : item.kind === 'due_soon'
                      ? 'border-amber-300 bg-white/80'
                      : 'border-amber-200/80 bg-white/60'
                }`}
              >
                <div>
                  <p className="font-semibold text-gray-900">{item.title}</p>
                  <p className="mt-0.5 text-xs text-gray-600">{item.body}</p>
                </div>
                {item.kind !== 'passed' && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={() => navigate(item.actionPath)}
                  >
                    Enter grades
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center text-white">
              <CheckCircle2 className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />
            </div>
            <div>
              <p className="text-2xl font-bold text-gold-600">{passRate}%</p>
              <p className="text-sm text-gray-500">Passing Rate</p>
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

