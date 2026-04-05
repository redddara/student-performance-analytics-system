import { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageIntro } from '../../components/layouts/PageIntro';
import { GlassCard, Select, Table, Spinner } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, calculateGWA } from '../../lib/supabase';

export default function StudentGradesPage() {
  const { user } = useAuthStore();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [myGrades, setMyGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [selectedQuarter, setSelectedQuarter] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

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

      const [subjectsRes, gradesRes] = await Promise.all([
        supabase.from('student_subjects').select('*, subject:subjects(*, course:courses(*))').eq('student_id', studentData.id),
        supabase.from('grades').select('*').eq('student_id', studentData.id),
      ]);

      setMySubjects(subjectsRes.data || []);
      setMyGrades(gradesRes.data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredGrades = () => {
    return myGrades.filter(g => g.semester === selectedSemester && (!selectedQuarter || g.quarter.toString() === selectedQuarter));
  };

  const getSubjectGrade = (subjectId: string, quarter: number) => {
    const grade = getFilteredGrades().find(g => 
      g.subject_id === subjectId.toString() && g.quarter === quarter
    );
    return grade?.grade?.toString() || '-';
  };

  const getSubjectAverage = (subjectId: string) => {
    const subjectGrades = getFilteredGrades().filter(g => g.subject_id === subjectId);
    if (subjectGrades.length === 0) return '-';
    const avg = calculateGWA(subjectGrades);
    return avg.toFixed(2).toString();
  };

  const calculateSemesterGWA = () => {
    const semesterGrades = getFilteredGrades();
    if (semesterGrades.length === 0) return '-';
    return calculateGWA(semesterGrades).toFixed(2);
  };

  const semesterSubjects = useMemo(
    () => mySubjects.filter((ss) => ss.subject?.semester === (selectedSemester === 1 ? '1st Sem' : '2nd Sem')),
    [mySubjects, selectedSemester]
  );

  const filteredSemesterSubjects = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    if (!q) return semesterSubjects;
    return semesterSubjects.filter((ss) => {
      const name = String(ss.subject?.name || '').toLowerCase();
      const course = String(ss.subject?.course?.name || '').toLowerCase();
      return name.includes(q) || course.includes(q);
    });
  }, [semesterSubjects, filterSearch]);

  if (loading) {
    return <DashboardLayout title="My Grades"><Spinner size="lg" /></DashboardLayout>;
  }

  return (
    <DashboardLayout title="My Grades">
      <PageIntro
        title="Grade report"
        subtitle="Pick semester and quarter, then search subjects below. Averages use recorded grades only."
      />

      <div className="mb-5 w-full max-w-2xl">
        <label htmlFor="student-grade-subject-search" className="sr-only">
          Search subjects
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-maroon-700/75" aria-hidden>
            <Search className="h-5 w-5 shrink-0" strokeWidth={2} />
          </span>
          <input
            id="student-grade-subject-search"
            type="search"
            autoComplete="off"
            placeholder="Search subject or course…"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="w-full rounded-2xl border border-white/70 bg-white/55 py-3.5 pl-12 pr-4 text-base text-gray-900 shadow-[0_8px_32px_rgba(128,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl placeholder:text-gray-500 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/35"
          />
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:p-5">
        <div className="w-full sm:min-w-[150px] sm:w-auto">
          <Select
            label="Semester"
            value={`${selectedSemester}`}
            onChange={e => setSelectedSemester(parseInt(e.target.value))}
            options={[{ value: "1", label: '1st Semester' }, { value: "2", label: '2nd Semester' }]}
          />
        </div>
        <div className="w-full sm:min-w-[160px] sm:w-auto">
          <Select 
            label="Quarter" 
            value={selectedQuarter} 
            onChange={e => setSelectedQuarter(e.target.value)} 
            options={[
              { value: "", label: 'All Quarters' },
              { value: "1", label: 'Prelim' },
              { value: "2", label: 'Midterm' },
              { value: "3", label: 'Pre-Finals' },
              { value: "4", label: 'Finals' }
            ]} 
          />
        </div>
        <p className="w-full text-sm text-gray-600 sm:pl-1">
          Showing <span className="font-semibold text-[#800000]">{filteredSemesterSubjects.length}</span> /{' '}
          {semesterSubjects.length} subject{semesterSubjects.length !== 1 ? 's' : ''} this semester
        </p>
      </div>

      <GlassCard className="p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-[#800000] mb-4">
          {selectedSemester === 1 ? '1st' : '2nd'} Semester Grades
        </h2>
        
        {filteredSemesterSubjects.length > 0 && (
          <Table headers={['Subject', 'Prelim', 'Midterm', 'Pre-Finals', 'Finals', 'Average']}>
            {filteredSemesterSubjects.map((ss) => (
              <tr key={ss.id} className="hover:bg-white/20">
                <td className="px-4 py-3 font-medium text-gray-800">{ss.subject?.name}</td>
                <td className="px-4 py-3 text-gray-600">{getSubjectGrade(ss.subject_id, 1)}</td>
                <td className="px-4 py-3 text-gray-600">{getSubjectGrade(ss.subject_id, 2)}</td>
                <td className="px-4 py-3 text-gray-600">{getSubjectGrade(ss.subject_id, 3)}</td>
                <td className="px-4 py-3 text-gray-600">{getSubjectGrade(ss.subject_id, 4)}</td>
                <td className="px-4 py-3 font-semibold text-[#800000]">{getSubjectAverage(ss.subject_id)}</td>
              </tr>
            ))}
          </Table>
        )}

        {semesterSubjects.length === 0 && (
          <p className="text-center text-gray-500 py-8">No subjects for this semester</p>
        )}

        {semesterSubjects.length > 0 && filteredSemesterSubjects.length === 0 && (
          <p className="text-center text-gray-500 py-8">No subjects match your search.</p>
        )}

        {semesterSubjects.length > 0 && (
          <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-[#800000] to-[#d4af37] text-white">
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center">
              <span className="font-semibold">Semester GWA:</span>
              <span className="text-2xl font-bold">{calculateSemesterGWA()}</span>
            </div>
          </div>
        )}
      </GlassCard>
    </DashboardLayout>
  );
}