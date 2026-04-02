import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Select, Table, Spinner, Badge } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, isPassing, calculateGWA } from '../../lib/supabase';

export default function StudentGradesPage() {
  const { user } = useAuthStore();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [myGrades, setMyGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSemester, setSelectedSemester] = useState(1);

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

  const getSubjectGrade = (subjectId: string, quarter: number) => {
    const grade = myGrades.find(g => 
      g.subject_id === subjectId && g.quarter === quarter && g.semester === selectedSemester
    );
    return grade?.grade || '-';
  };

  const getSubjectAverage = (subjectId: string) => {
    const subjectGrades = myGrades.filter(g => 
      g.subject_id === subjectId && g.semester === selectedSemester
    );
    if (subjectGrades.length === 0) return '-';
    const avg = calculateGWA(subjectGrades);
    return avg.toFixed(2);
  };

  const calculateSemesterGWA = () => {
    const semesterGrades = myGrades.filter(g => g.semester === selectedSemester);
    if (semesterGrades.length === 0) return '-';
    return calculateGWA(semesterGrades).toFixed(2);
  };

  if (loading) {
    return <DashboardLayout title="My Grades"><Spinner size="lg" /></DashboardLayout>;
  }

  const subjectIds = [...new Set(mySubjects.map(ss => ss.subject_id))];
  const semesterSubjects = mySubjects.filter(ss => ss.subject?.semester === (selectedSemester === 1 ? '1st Sem' : '2nd Sem'));

  return (
    <DashboardLayout title="My Grades">
      <div className="mb-6">
        <Select
          label="Semester"
          value={selectedSemester.toString()}
          onChange={e => setSelectedSemester(parseInt(e.target.value))}
          options={[{ value: '1', label: '1st Semester' }, { value: '2', label: '2nd Semester' }]}
        />
      </div>

      <GlassCard className="p-6">
        <h2 className="text-xl font-semibold text-[#800000] mb-4">
          {selectedSemester === 1 ? '1st' : '2nd'} Semester Grades
        </h2>
        
        <Table headers={['Subject', 'Prelim', 'Midterm', 'Pre-Finals', 'Finals', 'Average']}>
          {semesterSubjects.map(ss => (
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

        {semesterSubjects.length === 0 && (
          <p className="text-center text-gray-500 py-8">No subjects for this semester</p>
        )}

        {semesterSubjects.length > 0 && (
          <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-[#800000] to-[#d4af37] text-white">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Semester GWA:</span>
              <span className="text-2xl font-bold">{calculateSemesterGWA()}</span>
            </div>
          </div>
        )}
      </GlassCard>
    </DashboardLayout>
  );
}