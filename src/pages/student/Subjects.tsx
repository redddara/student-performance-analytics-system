import { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageIntro } from '../../components/layouts/PageIntro';
import { GlassCard, Spinner, Select } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase } from '../../lib/supabase';

export default function StudentSubjectsPage() {
  const { user } = useAuthStore();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterSemester, setFilterSemester] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: studentData } = await supabase.from('students').select('*').eq('user_id', user?.id).single();

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

  const filteredSubjects = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return mySubjects.filter((ss) => {
      const sub = ss.subject;
      const name = String(sub?.name || '').toLowerCase();
      const course = String(sub?.course?.name || '').toLowerCase();
      const teacher = String(
        sub?.teacher?.name || `${sub?.teacher?.first_name || ''} ${sub?.teacher?.last_name || ''}`
      )
        .trim()
        .toLowerCase();
      if (q && !name.includes(q) && !course.includes(q) && !teacher.includes(q)) return false;
      if (filterSemester && (sub?.semester || '') !== filterSemester) return false;
      return true;
    });
  }, [mySubjects, filterSearch, filterSemester]);

  if (loading) {
    return <DashboardLayout title="My Subjects"><Spinner size="lg" /></DashboardLayout>;
  }

  return (
    <DashboardLayout title="My Subjects">
      <PageIntro
        title="Enrolled subjects"
      />

      <div className="mb-5 w-full max-w-2xl">
        <label htmlFor="student-subject-search" className="sr-only">
          Search subjects
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-maroon-700/75" aria-hidden>
            <Search className="h-5 w-5 shrink-0" strokeWidth={2} />
          </span>
          <input
            id="student-subject-search"
            type="search"
            autoComplete="off"
            placeholder="Search subject, course, or teacher…"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="w-full rounded-2xl border border-white/70 bg-white/55 py-3.5 pl-12 pr-4 text-base text-gray-900 shadow-[0_8px_32px_rgba(128,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl placeholder:text-gray-500 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/35"
          />
        </div>
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="w-full sm:min-w-[200px] sm:max-w-xs">
            <Select
              label="Semester"
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              options={[
                { value: '', label: 'All semesters' },
                { value: '1st Sem', label: '1st Sem' },
                { value: '2nd Sem', label: '2nd Sem' },
              ]}
            />
          </div>
          <p className="text-sm text-gray-600 pb-2">
            Showing <span className="font-semibold text-[#800000]">{filteredSubjects.length}</span> / {mySubjects.length}{' '}
            subject{mySubjects.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <GlassCard className="p-4 sm:p-6">
        {mySubjects.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No subjects enrolled</p>
        ) : filteredSubjects.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No subjects match your search or semester filter.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredSubjects.map((ss) => (
              <div
                key={ss.id}
                className="rounded-2xl border border-maroon-200/40 bg-white/80 p-5 shadow-sm backdrop-blur-sm sm:p-6"
              >
                <h3 className="text-lg font-semibold text-[#800000] mb-3">{ss.subject?.name}</h3>
                <div className="space-y-2 text-sm leading-relaxed text-gray-700">
                  <p>
                    <span className="font-medium text-gray-800">Course:</span> {ss.subject?.course?.name}
                  </p>
                  <p>
                    <span className="font-medium text-gray-800">Year level:</span> {ss.subject?.year_level}
                  </p>
                  <p>
                    <span className="font-medium text-gray-800">Semester:</span> {ss.subject?.semester}
                  </p>
                  {ss.subject?.teacher && (
                    <p>
                      <span className="font-medium text-gray-800">Teacher:</span>{' '}
                      {ss.subject.teacher.name ||
                        `${ss.subject.teacher.first_name} ${ss.subject.teacher.last_name}`}
                    </p>
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
