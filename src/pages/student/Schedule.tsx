import { useState, useEffect, useMemo, useCallback } from 'react';
import { CalendarDays } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { StudentAcademicBanner } from '../../components/student/StudentAcademicBanner';
import { GlassCard, PageSkeletonLoader } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase } from '../../lib/supabase';
import { formatTeacherDisplayName } from '../../lib/personName';
import { compareAlphabetical } from '../../lib/sortUtils';
import {
  formatClassDaysLabel,
  partitionSubjectsByClassDays,
  WEEKLY_SCHEDULE_COLUMNS,
  type WeeklyScheduleItem,
} from '../../lib/classSchedule';
import {
  classifyStudentEnrollments,
  semesterLabelForStudent,
  type SubjectPrerequisite,
} from '../../lib/studentAcademicRules';
import { useSupabaseLiveReload } from '../../lib/useSupabaseLiveReload';
import type { GradeRecord } from '../../lib/studentGradeInsights';

type SubjectRow = {
  id: string;
  name?: string | null;
  class_days?: string | null;
  course?: { name?: string | null } | null;
  teacher?: Parameters<typeof formatTeacherDisplayName>[0] | null;
};

type EnrollmentRow = {
  id?: string;
  subject_id?: string;
  subject?: SubjectRow | null;
};

function ScheduleSubjectCard({ item }: { item: WeeklyScheduleItem }) {
  return (
    <div className="rounded-xl border border-maroon-200/60 bg-white/90 p-3 shadow-sm">
      <p className="font-semibold leading-snug text-[#800000]">{item.subjectName}</p>
      <p className="mt-1 text-xs text-gray-600">{item.courseName}</p>
      <p className="mt-1 text-xs text-gray-700">
        <span className="font-medium">Teacher:</span> {item.teacherName}
      </p>
      <p className="mt-1 text-xs text-gray-500">{item.classDaysLabel}</p>
      {(item.isBackSubject || item.isPastTermSubject) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {item.isBackSubject && (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
              Back subject
            </span>
          )}
          {item.isPastTermSubject && !item.isBackSubject && (
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-900">
              Previous term
            </span>
          )}
        </div>
      )}
    </div>
  );
}

type ScheduleSubjectWithMeta = SubjectRow & {
  isBackSubject: boolean;
  isPastTermSubject: boolean;
};

export default function StudentSchedulePage() {
  const { user } = useAuthStore();
  const [mySubjects, setMySubjects] = useState<EnrollmentRow[]>([]);
  const [myGrades, setMyGrades] = useState<GradeRecord[]>([]);
  const [prerequisites, setPrerequisites] = useState<SubjectPrerequisite[]>([]);
  const [studentProfile, setStudentProfile] = useState({ grade_level: '', current_semester: 1 });
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const { data: studentData } = await supabase.from('students').select('*').eq('user_id', user?.id).single();
      if (!studentData) return;

      setStudentProfile({
        grade_level: studentData.grade_level || '',
        current_semester: studentData.current_semester === 2 ? 2 : 1,
      });

      const [subjectsRes, gradesRes, prereqRes] = await Promise.all([
        supabase
          .from('student_subjects')
          .select('*, subject:subjects(*, course:courses(*), teacher:users(*))')
          .eq('student_id', studentData.id),
        supabase.from('grades').select('*').eq('student_id', studentData.id),
        supabase.from('subject_prerequisites').select('subject_id, prerequisite_subject_id, minimum_grade'),
      ]);

      setMySubjects((subjectsRes.data || []) as EnrollmentRow[]);
      setMyGrades((gradesRes.data || []) as GradeRecord[]);
      setPrerequisites((prereqRes.data || []) as SubjectPrerequisite[]);
    } catch (error) {
      console.error('Error loading schedule:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useSupabaseLiveReload(loadData, user?.id ? `live:student-schedule:${user.id}` : null, [
    'student_subjects',
    'subjects',
    'users',
    'students',
    'grades',
    'subject_prerequisites',
  ]);

  const academicView = useMemo(
    () => classifyStudentEnrollments(studentProfile, mySubjects, myGrades, prerequisites),
    [mySubjects, myGrades, prerequisites, studentProfile]
  );

  const scheduleSubjects = useMemo((): ScheduleSubjectWithMeta[] => {
    const rows: ScheduleSubjectWithMeta[] = [];
    for (const row of academicView.visible) {
      const sub = row.enrollment.subject;
      if (!sub?.id) continue;
      rows.push({
        ...sub,
        isBackSubject: row.isBackSubject,
        isPastTermSubject: Boolean(row.isPastTermSubject),
      });
    }
    return rows.sort((a, b) => compareAlphabetical(a.name || '', b.name || ''));
  }, [academicView]);

  const { byDay, daily } = useMemo(
    () =>
      partitionSubjectsByClassDays(scheduleSubjects, (sub) => ({
        subjectId: sub.id,
        subjectName: sub.name || 'Untitled subject',
        teacherName: sub.teacher ? formatTeacherDisplayName(sub.teacher) : '—',
        courseName: sub.course?.name || '—',
        classDaysLabel: formatClassDaysLabel(sub.class_days),
        isBackSubject: sub.isBackSubject,
        isPastTermSubject: sub.isPastTermSubject,
      })),
    [scheduleSubjects]
  );

  const weekdayColumns = useMemo(
    () => WEEKLY_SCHEDULE_COLUMNS.filter((col) => (byDay.get(col.day)?.length ?? 0) > 0),
    [byDay]
  );

  const hiddenPrerequisiteCount = academicView.hidden.filter((h) => h.hiddenReason === 'prerequisite').length;
  const semLabel = semesterLabelForStudent(studentProfile.current_semester);

  if (loading) {
    return (
      <DashboardLayout title="My Schedule">
        <PageSkeletonLoader rows={4} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="My Schedule">
      <StudentAcademicBanner
        currentSemester={studentProfile.current_semester}
        backSubjectCount={academicView.backSubjects.length}
        hiddenByPrerequisiteCount={hiddenPrerequisiteCount}
      />

      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-maroon-200/50 bg-white px-4 py-4 shadow-sm sm:px-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#800000] to-[#a52a2a] text-white">
          <CalendarDays className="h-6 w-6" strokeWidth={2} aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#800000]">Weekly class schedule — {semLabel}</h2>
          <p className="mt-1 text-sm text-gray-600">
            Based on class days set for each subject. Subjects you are taking this term appear below, including back
            subjects and earlier-term classes from this year.
          </p>
        </div>
      </div>

      {scheduleSubjects.length === 0 ? (
        <GlassCard className="p-5 sm:p-6">
          <p className="text-center text-gray-100">
            No subjects are available for your current semester yet. Your weekly schedule will appear here once you are
            enrolled.
          </p>
        </GlassCard>
      ) : (
        <>
          {weekdayColumns.length > 0 && (
            <>
              <div className="hidden gap-3 lg:grid lg:grid-cols-5 xl:grid-cols-7">
                {WEEKLY_SCHEDULE_COLUMNS.map((col) => {
                  const slots = byDay.get(col.day) || [];
                  if (slots.length === 0) return null;
                  return (
                    <div key={col.day} className="rounded-2xl border border-maroon-200/40 bg-maroon-50/40 p-3">
                      <h3 className="mb-3 text-center text-sm font-bold uppercase tracking-wide text-[#800000]">
                        {col.short}
                      </h3>
                      <div className="space-y-2">
                        {slots.map((item) => (
                          <ScheduleSubjectCard key={`${col.day}-${item.subjectId}`} item={item} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-4 lg:hidden">
                {WEEKLY_SCHEDULE_COLUMNS.map((col) => {
                  const slots = byDay.get(col.day) || [];
                  if (slots.length === 0) return null;
                  return (
                    <section
                      key={col.day}
                      className="rounded-2xl border border-maroon-200/40 bg-white p-4 shadow-sm"
                      aria-labelledby={`schedule-day-${col.day}`}
                    >
                      <h3 id={`schedule-day-${col.day}`} className="mb-3 text-base font-semibold text-[#800000]">
                        {col.label}
                      </h3>
                      <div className="space-y-2">
                        {slots.map((item) => (
                          <ScheduleSubjectCard key={`${col.day}-${item.subjectId}`} item={item} />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          )}

          {daily.length > 0 && (
            <GlassCard className="mt-6 p-4 sm:p-5">
              <h3 className="mb-3 text-base font-semibold text-[#800000]">Flexible / no fixed weekly days</h3>
              <p className="mb-4 text-sm text-gray-600">
                These subjects do not have a fixed weekly pattern on file. They may meet on multiple days or follow a
                flexible schedule set by your teacher.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {daily.map((item) => (
                  <ScheduleSubjectCard key={item.subjectId} item={item} />
                ))}
              </div>
            </GlassCard>
          )}

          {weekdayColumns.length === 0 && daily.length === 0 && (
            <GlassCard className="p-5 sm:p-6">
              <p className="text-center text-gray-100">
                Your subjects are listed, but no class-day schedules have been set yet. Ask your teacher or registrar to
                update subject schedules.
              </p>
            </GlassCard>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
