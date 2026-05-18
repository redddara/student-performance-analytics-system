import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSupabaseLiveReload } from '../../lib/useSupabaseLiveReload';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, PageSkeletonLoader } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, isPassing, computeSubjectFinalAverage, calculateOfficialGwa, toGradePoint, formatGwa } from '../../lib/supabase';
import {
  buildStudentGwaRemarkDistribution,
  buildSubjectPassFailData,
  averageSubjectFinalGradePoint,
  calculateGwaFromSubjectFinals,
  fetchActiveSchoolYear,
  isStudentPassingBySubjectFinals,
} from '../../lib/analyticsData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { chartAxis, chartGrid, chartTooltip } from '../../lib/chartTheme';
import { formatPersonDisplayName } from '../../lib/personName';

export default function TeacherAnalyticsPage() {
  const { user } = useAuthStore();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSchoolYearName, setActiveSchoolYearName] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      if (!user?.id) {
        setMySubjects([]);
        setGrades([]);
        setStudents([]);
        return;
      }

      const activeSy = await fetchActiveSchoolYear();
      setActiveSchoolYearName(activeSy?.name || '');

      const [subjectsRes, gradesRes, studentSubjectsRes] = await Promise.all([
        supabase.from('subjects').select('*, course:courses(*)').eq('teacher_id', user.id),
        (async () => {
          let q = supabase.from('grades').select('*');
          if (activeSy?.id) q = q.eq('school_year_id', activeSy.id);
          return q;
        })(),
        supabase.from('student_subjects').select('*, subject:subjects(*), student:students(*)'),
      ]);

      const subjects = subjectsRes.data || [];
      setMySubjects(subjects);
      setGrades(gradesRes.data || []);

      // Get unique students from my subjects
      const subjectIds = subjects.map((s) => s.id);
      const myStudentSubjects = (studentSubjectsRes.data || []).filter((ss) => subjectIds.includes(ss.subject_id));
      const uniqueStudentIds = [...new Set(myStudentSubjects.map((ss) => ss.student_id))];

      if (uniqueStudentIds.length === 0) {
        setStudents([]);
        return;
      }

      const { data: studentsData } = await supabase
        .from('students')
        .select('*, course:courses(*)')
        .in('id', uniqueStudentIds);
      setStudents(studentsData || []);
    } catch (error) {
      console.error('Error loading teacher analytics:', error);
      setMySubjects([]);
      setGrades([]);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useSupabaseLiveReload(loadData, user?.id ? `live:teacher-analytics:${user.id}` : null, [
    'grades',
    'student_subjects',
    'subjects',
    'students',
    'courses',
    'school_years',
  ]);

  // Get grades for my subjects only
  const mySubjectIds = mySubjects.map(s => s.id);
  const myGrades = grades.filter(g => mySubjectIds.includes(g.subject_id));

  const studentPerformance = useMemo(() => {
    const byStudent = new Map<string, { student_id: string; student_name: string; year_level: string; section: string; grades: any[] }>();
    students.forEach((student: any) => {
      byStudent.set(student.id, {
        student_id: student.id,
        student_name: formatPersonDisplayName(student) || 'Unknown',
        year_level: student.grade_level || '-',
        section: student.section || '-',
        grades: [],
      });
    });
    myGrades.forEach((grade) => {
      const bucket = byStudent.get(grade.student_id);
      if (bucket) bucket.grades.push(grade);
    });
    return Array.from(byStudent.values())
      .filter((entry) => entry.grades.length > 0)
      .map((entry) => ({
        ...entry,
        gwa: calculateGwaFromSubjectFinals(entry.grades),
        passing: isStudentPassingBySubjectFinals(entry.grades),
      }));
  }, [students, myGrades]);

  const pieData = buildStudentGwaRemarkDistribution(myGrades);

  const passingCount = studentPerformance.filter((s) => s.passing).length;
  const passFailData = [
    { name: 'Passing', value: passingCount },
    { name: 'Failing', value: studentPerformance.length - passingCount },
  ];

  // Subject Performance
  const subjectPerformance = mySubjects.map(sub => {
    const subjectGrades = myGrades.filter(g => g.subject_id === sub.id);
    const avg = subjectGrades.length > 0 ? averageSubjectFinalGradePoint(subjectGrades) : 0;
    return { name: (sub.name || 'Subject').substring(0, 15), average: avg, students: subjectGrades.length };
  }).filter(s => s.students > 0 && s.average > 0);

  // Quarterly Trends
  const quarterlyData = [1, 2, 3, 4].map(q => {
    const qGrades = myGrades.filter(g => g.quarter === q);
    const qStudentMap = new Map<string, number[]>();
    qGrades.forEach((grade) => {
      const list = qStudentMap.get(grade.student_id) || [];
      list.push(toGradePoint(Number(grade.grade)));
      qStudentMap.set(grade.student_id, list);
    });
    const qStudentPass = Array.from(qStudentMap.values()).filter((gradesList) => {
      const avg = gradesList.reduce((sum, value) => sum + value, 0) / gradesList.length;
      return isPassing(avg);
    }).length;
    return {
      quarter: `Q${q}`,
      average: qGrades.length > 0
        ? Math.round(qGrades.reduce((sum, g) => sum + toGradePoint(Number(g.grade)), 0) / qGrades.length * 100) / 100
        : 0,
      passingStudents: qStudentPass,
      totalStudents: qStudentMap.size,
    };
  });

  const subjectStudentPerformance = mySubjects.map((sub) => {
    const subjectGrades = myGrades.filter((g) => g.subject_id === sub.id);
    const byStudent = new Map<string, typeof subjectGrades>();
    subjectGrades.forEach((grade) => {
      const list = byStudent.get(grade.student_id) || [];
      list.push(grade);
      byStudent.set(grade.student_id, list);
    });
    const studentRows = Array.from(byStudent.entries()).map(([studentId, gradeList]) => {
      const student = students.find((s: any) => s.id === studentId);
      const summary = computeSubjectFinalAverage(gradeList);
      const avg = summary.gradePoint;
      return {
        studentName: formatPersonDisplayName(student || {}) || 'Unknown',
        yearLevel: student?.grade_level || '-',
        section: student?.section || '-',
        average: avg ?? 0,
        status: summary.status,
      };
    }).filter((row) => row.status !== 'inc' && Number.isFinite(row.average));
    if (studentRows.length === 0) return null;
    const sortedBest = [...studentRows].sort((a, b) => a.average - b.average);
    const sortedWorst = [...studentRows].sort((a, b) => b.average - a.average);
    const topStudent = sortedBest[0] || null;
    const atRiskStudent = sortedWorst[0] || null;
    return {
      subjectId: sub.id,
      subjectName: sub.name || 'Subject',
      topStudent,
      atRiskStudent,
    };
  }).filter(Boolean) as Array<any>;

  const subjectPassFailData = buildSubjectPassFailData(mySubjects, myGrades);

  if (loading) {
    return <DashboardLayout title="Analytics"><PageSkeletonLoader rows={5} /></DashboardLayout>;
  }

  return (
    <DashboardLayout title="My Analytics">
      {activeSchoolYearName && (
        <p className="mb-3 text-sm text-gray-600">
          Active School Year: <span className="font-semibold text-[#800000]">{activeSchoolYearName}</span>
        </p>
      )}
    
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8">
        <GlassCard className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-[#800000] mb-4">Grade Distribution (General Average)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => percent ? `${name} (${(percent * 100).toFixed(0)}%)` : name} outerRadius={60} fill="#8884d8" dataKey="value">
                {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
              </Pie>
              <Tooltip {...chartTooltip} />
            </PieChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-[#800000] mb-4">Pass/Fail Rate</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={passFailData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => percent ? `${name}: ${(percent * 100).toFixed(0)}%` : name} outerRadius={60} fill="#8884d8" dataKey="value">
                {passFailData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.name === 'Passing' ? '#4CAF50' : '#f44336'} />)}
              </Pie>
              <Tooltip {...chartTooltip} />
            </PieChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-[#800000] mb-4">Subject Performance</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={subjectPerformance}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="name" fontSize={10} {...chartAxis} />
              <YAxis domain={[1, 5]} reversed fontSize={10} {...chartAxis} />
              <Tooltip formatter={(value) => [value, 'Avg GWA']} {...chartTooltip} />
              <Bar dataKey="average" fill="#800000" />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-[#800000] mb-4">Quarterly Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={quarterlyData}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="quarter" {...chartAxis} />
              <YAxis domain={[1, 5]} reversed {...chartAxis} />
              <Tooltip {...chartTooltip} />
              <Line type="monotone" dataKey="average" stroke="#d4af37" strokeWidth={2} name="Avg GWA" />
              <Line type="monotone" dataKey="passingStudents" stroke="#4CAF50" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      <GlassCard className="p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-[#800000] mb-4">Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 glass-inset">
            <p className="text-2xl font-bold text-[#800000]">{students.length}</p>
            <p className="text-sm text-gray-600">Students</p>
          </div>
          <div className="text-center p-4 glass-inset">
            <p className="text-2xl font-bold text-[#d4af37]">{mySubjects.length}</p>
            <p className="text-sm text-gray-600">Subjects</p>
          </div>
          <div className="text-center p-4 glass-inset">
            <p className="text-2xl font-bold text-green-600">{studentPerformance.length > 0 ? Math.round((passingCount / studentPerformance.length) * 100) : 0}%</p>
            <p className="text-sm text-gray-600">Passing Rate</p>
          </div>
          <div className="text-center p-4 glass-inset">
            <p className="text-2xl font-bold text-blue-600">
              {studentPerformance.length > 0
                ? formatGwa(
                    calculateOfficialGwa(studentPerformance.map((s) => s.gwa))
                  )
                : '—'}
            </p>
            <p className="text-sm text-gray-600">Average Student GWA</p>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="mt-6 p-4 sm:p-6">
        <h3 className="mb-4 text-lg font-semibold text-[#800000]">Per-subject student performance watchlist</h3>
        {subjectStudentPerformance.length === 0 ? (
          <p className="text-gray-500">No student performance data yet.</p>
        ) : (
          <div className="space-y-3">
            {subjectStudentPerformance.map((row) => (
              <div key={row.subjectId} className="rounded-2xl border border-gold-300/30 bg-white/5 p-4">
                <p className="font-semibold text-gold-100">{row.subjectName}</p>
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="rounded-xl border border-green-400/35 bg-green-500/15 p-3 text-sm text-green-100">
                    <p className="font-semibold">Performing well</p>
                    {row.topStudent && row.topStudent.status === 'passed' ? (
                      <>
                        <p>{row.topStudent.studentName} ({row.topStudent.yearLevel} • {row.topStudent.section})</p>
                        <p className="font-semibold">Avg {formatGwa(row.topStudent.average)}</p>
                      </>
                    ) : (
                      <p>No passing student yet in this subject.</p>
                    )}
                  </div>
                  <div className="rounded-xl border border-red-400/35 bg-red-500/15 p-3 text-sm text-red-100">
                    <p className="font-semibold">Needs attention</p>
                    {row.atRiskStudent && row.atRiskStudent.status === 'failed' ? (
                      <>
                        <p>{row.atRiskStudent.studentName} ({row.atRiskStudent.yearLevel} • {row.atRiskStudent.section})</p>
                        <p className="font-semibold">Avg {formatGwa(row.atRiskStudent.average)}</p>
                      </>
                    ) : (
                      <p>No at-risk student in this subject.</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard className="mt-6 p-4 sm:p-6">
        <h3 className="mb-4 text-lg font-semibold text-[#800000]">Pass/Fail by your subjects</h3>
        {subjectPassFailData.length === 0 ? (
          <p className="text-gray-500">No pass/fail data yet for your subjects.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={subjectPassFailData}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="name" fontSize={10} {...chartAxis} />
              <YAxis allowDecimals={false} {...chartAxis} />
              <Tooltip {...chartTooltip} />
              <Bar dataKey="Passing" stackId="a" fill="#4CAF50" />
              <Bar dataKey="Failing" stackId="a" fill="#f44336" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </GlassCard>
    </DashboardLayout>
  );
}