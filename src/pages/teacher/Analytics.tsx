import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Spinner } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, isPassing } from '../../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const COLORS = ['#800000', '#d4af37', '#4CAF50', '#f44336', '#2196F3'];

export default function TeacherAnalyticsPage() {
  const { user } = useAuthStore();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [subjectsRes, gradesRes, studentSubjectsRes] = await Promise.all([
      supabase.from('subjects').select('*, course:courses(*)').eq('teacher_id', user?.id),
      supabase.from('grades').select('*'),
      supabase.from('student_subjects').select('*, subject:subjects(*), student:students(*)'),
    ]);

    const subjects = subjectsRes.data || [];
    setMySubjects(subjects);
    setGrades(gradesRes.data || []);

    // Get unique students from my subjects
    const subjectIds = subjects.map(s => s.id);
    const myStudentSubjects = (studentSubjectsRes.data || []).filter(ss => subjectIds.includes(ss.subject_id));
    const uniqueStudentIds = [...new Set(myStudentSubjects.map(ss => ss.student_id))];
    
    const { data: studentsData } = await supabase.from('students').select('*, course:courses(*)').in('id', uniqueStudentIds);
    setStudents(studentsData || []);
    setLoading(false);
  };

  if (loading) {
    return <DashboardLayout title="Analytics"><Spinner size="lg" /></DashboardLayout>;
  }

  // Get grades for my subjects only
  const mySubjectIds = mySubjects.map(s => s.id);
  const myGrades = grades.filter(g => mySubjectIds.includes(g.subject_id));

  // Grade Distribution
  const gradeDistribution = [0, 0, 0, 0, 0];
  myGrades.forEach(g => {
    if (g.grade >= 90) gradeDistribution[0]++;
    else if (g.grade >= 85) gradeDistribution[1]++;
    else if (g.grade >= 80) gradeDistribution[2]++;
    else if (g.grade >= 75) gradeDistribution[3]++;
    else gradeDistribution[4]++;
  });

  const pieData = [
    { name: 'Excellent (90+)', value: gradeDistribution[0] },
    { name: 'Good (85-89)', value: gradeDistribution[1] },
    { name: 'Fair (80-84)', value: gradeDistribution[2] },
    { name: 'Passing (75-79)', value: gradeDistribution[3] },
    { name: 'Below 75', value: gradeDistribution[4] },
  ].filter(d => d.value > 0);

  // Pass/Fail
  const passingCount = myGrades.filter(g => isPassing(g.grade)).length;
  const passFailData = [
    { name: 'Passing', value: passingCount },
    { name: 'Failing', value: myGrades.length - passingCount },
  ];

  // Subject Performance
  const subjectPerformance = mySubjects.map(sub => {
    const subjectGrades = myGrades.filter(g => g.subject_id === sub.id);
    const avg = subjectGrades.length > 0 
      ? Math.round(subjectGrades.reduce((sum, g) => sum + g.grade, 0) / subjectGrades.length * 100) / 100
      : 0;
    return { name: sub.name.substring(0, 15), average: avg, students: subjectGrades.length };
  }).filter(s => s.students > 0);

  // Quarterly Trends
  const quarterlyData = [1, 2, 3, 4].map(q => {
    const qGrades = myGrades.filter(g => g.quarter === q);
    return {
      quarter: `Q${q}`,
      average: qGrades.length > 0 ? Math.round(qGrades.reduce((sum, g) => sum + g.grade, 0) / qGrades.length * 100) / 100 : 0,
    };
  });

  return (
    <DashboardLayout title="My Analytics">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold text-[#800000] mb-4">Grade Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie 
                data={pieData} 
                cx="50%" 
                cy="50%" 
                labelLine={false} 
                label={({ name, percent }) => percent != null ? `${name} (${(percent * 100).toFixed(0)}%)` : name} 
                outerRadius={60} 
                fill="#8884d8" 
                dataKey="value"
              >
                {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold text-[#800000] mb-4">Pass/Fail Rate</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie 
                data={passFailData} 
                cx="50%" 
                cy="50%" 
                labelLine={false} 
                label={({ name, percent }) => percent != null ? `${name}: ${(percent * 100).toFixed(0)}%` : name} 
                outerRadius={60} 
                fill="#8884d8" 
                dataKey="value"
              >
                {passFailData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.name === 'Passing' ? '#4CAF50' : '#f44336'} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold text-[#800000] mb-4">Subject Performance</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={subjectPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={10} />
              <YAxis domain={[0, 100]} fontSize={10} />
              <Tooltip />
              <Bar dataKey="average" fill="#800000" />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold text-[#800000] mb-4">Quarterly Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={quarterlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="quarter" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="average" stroke="#d4af37" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold text-[#800000] mb-4">Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 rounded-xl bg-white/30">
            <p className="text-2xl font-bold text-[#800000]">{students.length}</p>
            <p className="text-sm text-gray-600">Students</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-white/30">
            <p className="text-2xl font-bold text-[#d4af37]">{mySubjects.length}</p>
            <p className="text-sm text-gray-600">Subjects</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-white/30">
            <p className="text-2xl font-bold text-green-600">{myGrades.length > 0 ? Math.round((passingCount / myGrades.length) * 100) : 0}%</p>
            <p className="text-sm text-gray-600">Pass Rate</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-white/30">
            <p className="text-2xl font-bold text-blue-600">{myGrades.length > 0 ? Math.round(myGrades.reduce((sum, g) => sum + g.grade, 0) / myGrades.length * 100) / 100 : 0}</p>
            <p className="text-sm text-gray-600">Average</p>
          </div>
        </div>
      </GlassCard>
    </DashboardLayout>
  );
}
