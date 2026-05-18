import { useState, useEffect, useCallback } from 'react';
import { useGradesAutoRefresh } from '../../lib/useGradesAutoRefresh';
import { BookOpen, CheckCircle2, Target } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, PageSkeletonLoader } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, formatGwa } from '../../lib/supabase';
import {
  calculateGwaFromSubjectFinals,
  fetchActiveSchoolYear,
  filterGradesBySchoolYear,
} from '../../lib/analyticsData';
import { countPassingSubjectsByFinalGrade } from '../../lib/studentGradeInsights';
import { StudentAcademicBanner } from '../../components/student/StudentAcademicBanner';
import { StudentSubjectsNeedToPassPanel } from '../../components/student/StudentSubjectsNeedToPassPanel';
import { buildSubjectsNeedToPass } from '../../lib/subjectPassRecovery';
import {
  classifyStudentEnrollments,
  type SubjectPrerequisite,
} from '../../lib/studentAcademicRules';
import { formatTeacherDisplayName } from '../../lib/personName';
import type { GradeRecord } from '../../lib/studentGradeInsights';

export default function StudentDashboard() {
  const { user } = useAuthStore();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [myGrades, setMyGrades] = useState<GradeRecord[]>([]);
  const [prerequisites, setPrerequisites] = useState<SubjectPrerequisite[]>([]);
  const [studentProfile, setStudentProfile] = useState({ grade_level: '', current_semester: 1 });
  const [loading, setLoading] = useState(true);
  const [activeSchoolYearId, setActiveSchoolYearId] = useState<string | null>(null);
  const [activeSchoolYearName, setActiveSchoolYearName] = useState('');

  const loadData = useCallback(async () => {
    try {
      const { data: studentData } = await supabase
        .from('students')
        .select('*, course:courses(*)')
        .eq('user_id', user?.id)
        .single();

      if (!studentData) {
        setLoading(false);
        return;
      }

      setStudentProfile({
        grade_level: studentData.grade_level || '',
        current_semester: studentData.current_semester === 2 ? 2 : 1,
      });

      const activeSy = await fetchActiveSchoolYear();
      setActiveSchoolYearId(activeSy?.id ?? null);
      setActiveSchoolYearName(activeSy?.name || '');

      const [subjectsRes, gradesRes, prereqRes] = await Promise.all([
        supabase
          .from('student_subjects')
          .select('*, subject:subjects(*, course:courses(*), teacher:users(*))')
          .eq('student_id', studentData.id),
        supabase.from('grades').select('*').eq('student_id', studentData.id),
        supabase.from('subject_prerequisites').select('subject_id, prerequisite_subject_id, minimum_grade'),
      ]);

      setMySubjects(subjectsRes.data || []);
      setMyGrades((gradesRes.data || []) as GradeRecord[]);
      setPrerequisites((prereqRes.data || []) as SubjectPrerequisite[]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useGradesAutoRefresh(loadData, user?.id ? `grades-live:student-dashboard:${user.id}` : null);

  if (loading) {
    return <DashboardLayout title="Dashboard"><PageSkeletonLoader /></DashboardLayout>;
  }

  const academicView = classifyStudentEnrollments(studentProfile, mySubjects, myGrades, prerequisites);
  const visibleSubjectIds = new Set(
    academicView.visible
      .map((v) => v.enrollment.subject?.id || v.enrollment.subject_id)
      .filter((id): id is string => Boolean(id))
  );
  const yearGrades = filterGradesBySchoolYear(myGrades, activeSchoolYearId);
  const visibleGrades = yearGrades.filter((g) => g.subject_id && visibleSubjectIds.has(g.subject_id));
  const passingSubjects = countPassingSubjectsByFinalGrade(visibleGrades);
  const gwa = calculateGwaFromSubjectFinals(visibleGrades);
  const hiddenPrerequisiteCount = academicView.hidden.filter((h) => h.hiddenReason === 'prerequisite').length;

  const subjectNames = new Map<string, string>();
  for (const row of academicView.visible) {
    const id = row.enrollment.subject?.id || row.enrollment.subject_id;
    if (id) subjectNames.set(id, row.enrollment.subject?.name || 'Subject');
  }
  const subjectsNeedToPass = buildSubjectsNeedToPass({
    grades: visibleGrades,
    activeSchoolYearId,
    currentSemester: studentProfile.current_semester,
    visibleSubjectIds,
    subjectNames,
  });

  const semesterLabel =
    studentProfile.current_semester === 2 ? '2nd Semester' : '1st Semester';

  return (
    <DashboardLayout title="Student Dashboard">
      <StudentAcademicBanner
        currentSemester={studentProfile.current_semester}
        backSubjectCount={academicView.backSubjects.length}
        hiddenByPrerequisiteCount={hiddenPrerequisiteCount}
      />
      {activeSchoolYearName && (
        <p className="mb-3 text-sm text-gray-600">
          Active School Year: <span className="font-semibold text-[#800000]">{activeSchoolYearName}</span>
          {' '}(GWA and passing subjects use this year only)
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#800000] to-[#a52a2a] flex items-center justify-center text-white">
              <BookOpen className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#800000]">{academicView.visible.length}</p>
              <p className="text-sm text-gray-500">Visible Subjects (this term)</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center text-white">
              <CheckCircle2 className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />
            </div>
            <div>
              <p className="text-2xl font-bold text-gold-600">{passingSubjects}</p>
              <p className="text-sm text-gray-500">Passing Subjects</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-maroon-500 to-maroon-600 flex items-center justify-center text-white">
              <Target className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />
            </div>
            <div>
              <p className="text-2xl font-bold text-maroon-600">{formatGwa(gwa)}</p>
              <p className="text-sm text-gray-500">GWA</p>
            </div>
          </div>
        </GlassCard>
      </div>

      <StudentSubjectsNeedToPassPanel
        subjects={subjectsNeedToPass}
        schoolYearLabel={activeSchoolYearName || undefined}
        semesterLabel={semesterLabel}
      />

      <GlassCard className="p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-[#800000] mb-4">My Subjects</h2>
        {mySubjects.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No subjects enrolled</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mySubjects.map((ss) => (
              <div key={ss.id} className="p-4 glass-inset">
                <h3 className="font-semibold text-gray-800">{ss.subject?.name}</h3>
                <p className="text-sm text-gray-500">{ss.subject?.course?.name}</p>
                <p className="text-sm text-gray-500">
                  {ss.subject?.year_level} - {ss.subject?.semester}
                </p>
                {ss.subject?.teacher && (
                  <p className="text-xs text-gray-400 mt-2 break-words">
                    Teacher:{' '}
                    {formatTeacherDisplayName(ss.subject.teacher)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </DashboardLayout>
  );
}
