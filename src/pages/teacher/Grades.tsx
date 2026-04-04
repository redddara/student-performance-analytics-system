import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Select, Table, Spinner, Badge } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, isPassing } from '../../lib/supabase';

export default function TeacherGradesPage() {
  const { user } = useAuthStore();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [selectedQuarter, setSelectedQuarter] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [subjectsRes, gradesRes, studentsRes] = await Promise.all([
      supabase.from('subjects').select('*, course:courses(*)').eq('teacher_id', user?.id),
      supabase.from('grades').select('*'),
      supabase.from('students').select('*, user:users(*)'),
    ]);
    setMySubjects(subjectsRes.data || []);
    setGrades(gradesRes.data || []);
    setStudents(studentsRes.data || []);
    if (subjectsRes.data?.length) setSelectedSubject(subjectsRes.data[0].id);
    setLoading(false);
  };

  const getSubjectGrades = () => {
    if (!selectedSubject) return [];
    return grades.filter(g => g.subject_id === selectedSubject && g.semester === selectedSemester && (!selectedQuarter || g.quarter.toString() === selectedQuarter));
  };

  const getStudentName = (id: string) => {
    const s = students.find(st => st.id === id);
    return s ? `${s.first_name} ${s.last_name}` : 'Unknown';
  };

  const getSubjectName = (id: string) => {
    const s = mySubjects.find(sub => sub.id === id);
    return s?.name || 'Unknown';
  };

  if (loading) {
    return <DashboardLayout title="Grades"><Spinner size="lg" /></DashboardLayout>;
  }

  return (
    <DashboardLayout title="Grade Management">
      <GlassCard className="p-4 sm:p-6 mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
          <div className="w-full sm:min-w-[200px] sm:w-auto sm:max-w-md">
            <Select label="Subject" value={`${selectedSubject}`} onChange={e => setSelectedSubject(e.target.value)} options={mySubjects.map(s => ({ value: `${s.id}`, label: s.name }))} />
          </div>
          <div className="w-full sm:min-w-[140px] sm:w-auto">
            <Select label="Semester" value={`${selectedSemester}`} onChange={e => setSelectedSemester(parseInt(e.target.value))} options={[{ value: "1", label: '1st Semester' }, { value: "2", label: '2nd Semester' }]} />
          </div>
          <div className="w-full sm:min-w-[140px] sm:w-auto">
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
        </div>
      </GlassCard>

      <GlassCard className="p-4 sm:p-6">
        <Table headers={['Student', 'Subject', 'Semester', 'Quarter', 'Grade', 'Remarks', 'Status']}>
          {getSubjectGrades().map(grade => (
            <tr key={grade.id} className="hover:bg-white/20">
              <td className="px-4 py-3 font-medium text-gray-800">{getStudentName(grade.student_id)}</td>
              <td className="px-4 py-3 text-gray-600">{getSubjectName(grade.subject_id)}</td>
              <td className="px-4 py-3 text-gray-600">{grade.semester === 1 ? '1st Sem' : '2nd Sem'}</td>
              <td className="px-4 py-3 text-gray-600">
                {['', 'Prelim', 'Midterm', 'Pre-Finals', 'Finals'][grade.quarter]}
              </td>
              <td className="px-4 py-3 font-medium text-gray-800">{grade.grade}</td>
              <td className="px-4 py-3 text-gray-600">{grade.remarks || '-'}</td>
              <td className="px-4 py-3">
                <Badge variant={isPassing(grade.grade) ? 'success' : 'danger'}>
                  {isPassing(grade.grade) ? 'Passing' : 'Failing'}
                </Badge>
              </td>
            </tr>
          ))}
        </Table>
        {getSubjectGrades().length === 0 && <p className="text-center text-gray-500 py-8">No grades found</p>}
      </GlassCard>
    </DashboardLayout>
  );
}