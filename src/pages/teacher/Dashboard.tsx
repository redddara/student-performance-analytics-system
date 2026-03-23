import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { DashboardLayout } from '../../components/layouts';
import { Card, StatCard, Button, Table, Badge } from '../../components/ui';
import { 
  GradeDistributionChart, 
  PassingRateChart, 
  PerformanceTrendChart,
  SubjectComparisonChart 
} from '../../components/charts';
import type { StudentPerformance, Subject, Grade } from '../../types';
import { 
  BookOpen, 
  GraduationCap, 
  TrendingUp,
  Award,
  AlertTriangle,
  Users
} from 'lucide-react';

const TeacherDashboard: React.FC = () => {
  const { user, subjects, grades, students, getTeacherSubjects, calculateGWA, fetchGrades } = useStore();
  const [mySubjects, setMySubjects] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      const teacherSubjects = getTeacherSubjects(user.id);
      setMySubjects(teacherSubjects);
    }
  }, [user, subjects]);

  // Get grades for my subjects
  const mySubjectGrades = grades.filter(g => 
    mySubjects.some(s => s.id === g.subject_id)
  );

  // Calculate stats
  const totalStudents = new Set(
    mySubjectGrades.map(g => g.student_id)
  ).size;

  const passingGrades = mySubjectGrades.filter(g => Number(g.grade) >= 75);
  const passingRate = mySubjectGrades.length > 0 
    ? (passingGrades.length / mySubjectGrades.length) * 100 
    : 0;

  const avgGrade = mySubjectGrades.length > 0
    ? mySubjectGrades.reduce((sum, g) => sum + Number(g.grade), 0) / mySubjectGrades.length
    : 0;

  // Subject performance
  const subjectPerformance = mySubjects.map(subject => {
    const subjectGrades = mySubjectGrades.filter(g => g.subject_id === subject.id);
    const avg = subjectGrades.length > 0
      ? subjectGrades.reduce((sum, g) => sum + Number(g.grade), 0) / subjectGrades.length
      : 0;
    return {
      subject: subject.name,
      avgGrade: Math.round(avg * 100) / 100,
      studentCount: new Set(subjectGrades.map(g => g.student_id)).size
    };
  });

  // Student performance for my subjects - per subject evaluation
  const studentGradesMap = new Map();
  mySubjectGrades.forEach(g => {
    if (!studentGradesMap.has(g.student_id)) {
      studentGradesMap.set(g.student_id, []);
    }
    studentGradesMap.get(g.student_id).push(g);
  });

  const studentPerformance: StudentPerformance[] = Array.from(studentGradesMap.entries()).map(([studentId, studentGrades]) => {
    const student = students.find(s => s.id === studentId);
    const avg = studentGrades.reduce((sum: number, g: Grade) => sum + Number(g.grade), 0) / studentGrades.length;
    
    // Group by subject and calculate average grade per subject
    const subjectAvgMap = new Map<string, { subject: Subject; grades: number[] }>();
    studentGrades.forEach((g: Grade) => {
      const subjectId = g.subject_id;
      if (!subjectAvgMap.has(subjectId)) {
        subjectAvgMap.set(subjectId, { subject: g.subject!, grades: [] });
      }
      const current = subjectAvgMap.get(subjectId)!;
      current.grades.push(Number(g.grade));
    });

    const weakSubjects: { subject: Subject; avgGrade: number }[] = [];
    subjectAvgMap.forEach(({ subject, grades }) => {
      const avgGrade = grades.reduce((sum: number, grade: number) => sum + grade, 0) / grades.length;
      if (avgGrade < 75) {
        weakSubjects.push({ subject, avgGrade: Math.round(avgGrade * 100) / 100 });
      }
    });
    
    const needsAttention = weakSubjects.length > 0;
    
    return {
      student: student!,
      avgGrade: Math.round(avg * 100) / 100,
      weakSubjects: weakSubjects as any, // Type compatible with original
      needsAttention
    };
  }).sort((a, b) => b.avgGrade - a.avgGrade);

  // Per-subject top performers (top 3 students per subject, avg >= 75 only)
  const subjectTopPerformers = mySubjects.map(subject => {
    const subjectGrades = mySubjectGrades.filter(g => g.subject_id === subject.id);
    const studentSubjectAvgs = new Map();
    subjectGrades.forEach(g => {
      if (!studentSubjectAvgs.has(g.student_id)) {
        studentSubjectAvgs.set(g.student_id, {student: g.student!, sum: 0, count: 0});
      }
      const current = studentSubjectAvgs.get(g.student_id)!;
      current.sum += Number(g.grade);
      current.count += 1;
    });
    const perf = Array.from(studentSubjectAvgs.values())
      .map(({student, sum, count}) => {
        const avgGrade = Math.round((sum / count) * 100) / 100;
        return { student, avgGrade };
      })
      .filter(p => p.avgGrade >= 75)
      .sort((a,b) => b.avgGrade - a.avgGrade)
      .slice(0, 3);
    return { 
      subject: subject.name, 
      topStudents: perf 
    };
  });

  const topPerformers = []; // Deprecated - now per subject
  const strugglingStudents = studentPerformance.filter(s => s.needsAttention).slice(0, 5);

  // Grade distribution
  const gradeRanges = [
    { range: '90-100', min: 90, max: 100, count: 0 },
    { range: '85-89', min: 85, max: 89, count: 0 },
    { range: '80-84', min: 80, max: 84, count: 0 },
    { range: '75-79', min: 75, max: 79, count: 0 },
    { range: 'Below 75', min: 0, max: 74, count: 0 },
  ];

  mySubjectGrades.forEach(g => {
    const grade = Number(g.grade);
    gradeRanges.forEach(r => {
      if (grade >= r.min && grade <= r.max) r.count++;
    });
  });

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Teacher Dashboard</h1>
          <p className="text-gray-400 mt-2">Welcome back, {user?.name}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="My Subjects"
            value={mySubjects.length}
            icon={<BookOpen size={24} />}
          />
          <StatCard
            title="Students"
            value={totalStudents}
            icon={<Users size={24} />}
          />
          <StatCard
            title="Average Grade"
            value={avgGrade.toFixed(2)}
            icon={<TrendingUp size={24} />}
          />
          <StatCard
            title="Passing Rate"
            value={`${passingRate.toFixed(1)}%`}
            icon={<Award size={24} />}
          />
        </div>

        {/* Subject Performance */}
        {subjectPerformance.length > 0 && (
          <Card>
            <h3 className="text-xl font-semibold text-white mb-4">Subject Performance</h3>
            <SubjectComparisonChart data={subjectPerformance} />
          </Card>
        )}

        {/* Grade Distribution & Passing Rate */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-xl font-semibold text-white mb-4">Grade Distribution</h3>
            <GradeDistributionChart data={gradeRanges.map(r => ({ range: r.range, count: r.count }))} />
          </Card>

          <Card>
            <h3 className="text-xl font-semibold text-white mb-4">Passing Rate</h3>
            <PassingRateChart passingRate={passingRate} failingRate={100 - passingRate} />
          </Card>
        </div>

        {/* Top & Struggling Students */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Award className="text-yellow-400" size={24} />
              Top Performers Per Subject
            </h3>
            <Table headers={['Subject', 'Rank', 'Student', 'Avg Grade']}>
              {subjectTopPerformers.filter(({ topStudents }) => topStudents.length > 0).map(({ subject, topStudents }) => 
                topStudents.map(({ student, avgGrade }, rank) => (
                  <tr key={`${subject}-${student.id}`} className="hover:bg-white/10 group even:bg-black/10">
                    <td className="px-8 py-5 font-semibold text-left">
                      <div className="inline-flex items-center gap-3 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 px-4 py-2 rounded-xl text-sm shadow-md">
                      {subject}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <div className="inline-flex items-center justify-center gap-2 bg-gradient-to-br from-yellow-400/70 to-yellow-500/70 text-black font-black text-xl px-5 py-3 rounded-2xl shadow-xl ring-2 ring-yellow-300/50 min-w-[100px]">
                        #{rank + 1}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="font-bold text-lg text-white truncate max-w-[200px]">
                        {student.first_name} {student.last_name}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="inline-flex items-center gap-3 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 px-6 py-3 rounded-xl font-mono font-bold text-lg text-indigo-200 shadow-lg backdrop-blur-sm border border-indigo-400/40 min-w-[110px]">
                        {avgGrade.toFixed(1)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {subjectTopPerformers.filter(({ topStudents }) => topStudents.length > 0).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-12 py-20 text-center bg-gradient-to-r from-yellow-500/10 backdrop-blur-sm rounded-b-2xl">
                    <Award className="mx-auto h-20 w-20 text-yellow-400/40 mb-6 animate-pulse" />
                    <h4 className="text-2xl font-bold text-white mb-3">No Top Performers Yet</h4>
                    <p className="text-gray-400 text-xl max-w-lg mx-auto leading-relaxed">Students need 75+ average to appear here</p>
                  </td>
                </tr>
              )}
          </Table>
          </Card>

          <Card>
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="text-red-400" size={24} />
              Needs Attention
            </h3>
            {/* Summary */}
            <div className="mb-6 p-4 bg-gradient-to-r from-red-500/20 to-orange-500/20 border-2 border-red-400/50 rounded-xl backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-400" />
                <div>
                  <p className="text-lg font-semibold text-white">{strugglingStudents.length} students need attention</p>
                  <p className="text-sm text-orange-200">Focus on these students for intervention</p>
                </div>
              </div>
            </div>

            <Table headers={['Student', 'Overall Avg', 'Weak Subjects (Avg)', 'Priority', 'Action']}>
              {strugglingStudents.length > 0 ? strugglingStudents.map(({ student, weakSubjects, avgGrade }) => {
                const weakList = weakSubjects
                  .map((ws: any) => `${ws.subject.name} (${ws.avgGrade.toFixed(1)})` )
                  .join(', ');
                const worstAvg = Math.min(...(weakSubjects as any[]).map(ws => ws.avgGrade));
                const priorityVariant = worstAvg < 60 ? 'danger' : 'warning';
                const priorityLabel = worstAvg < 60 ? 'High Risk' : 'Monitor';
                return (
                  <tr key={student.id} className="hover:bg-white/10 transition-all duration-200 border-l-4 border-red-400 hover:border-red-300">
                    <td className="px-4 py-3 font-medium text-white max-w-xs truncate" title={`${student.first_name} ${student.last_name}`}>
                      {student.first_name} {student.last_name}
                    </td>
                    <td className="px-4 py-3 text-indigo-300 font-semibold max-w-xs">
                      {avgGrade.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-red-300 max-w-lg truncate" title={weakList}>
                      {weakList}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={priorityVariant}>{priorityLabel}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="danger" className="text-red-50 hover:shadow-red-500/30">
                        View Details
                      </Button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                    🎉 No students needing attention!
                  </td>
                </tr>
              )}
            </Table>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TeacherDashboard;

