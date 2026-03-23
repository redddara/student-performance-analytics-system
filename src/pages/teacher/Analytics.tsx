import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { DashboardLayout } from '../../components/layouts';
import { Card, StatCard, Select, Table, Badge, Button } from '../../components/ui';
import { 
  GradeDistributionChart, 
  PerformanceTrendChart,
  SubjectComparisonChart,
  QuarterlyPerformanceChart 
} from '../../components/charts';
import type { StudentPerformance } from '../../types';
import type { Subject, Grade } from '../../types';
import { 
  BookOpen, 
  GraduationCap, 
  TrendingUp,
  Award,
  AlertTriangle,
  Users
} from 'lucide-react';

const TeacherAnalytics: React.FC = () => {
  const { user, subjects, grades, students, getTeacherSubjects, calculateGWA } = useStore();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [semesterFilter, setSemesterFilter] = useState('all');

  useEffect(() => {
    if (user) {
      const teacherSubjects = getTeacherSubjects(user.id);
      setMySubjects(teacherSubjects);
    }
  }, [user, subjects]);

  // Filter grades
  let filteredGrades = grades.filter(g => 
    mySubjects.some(s => s.id === g.subject_id)
  );

  if (subjectFilter !== 'all') {
    filteredGrades = filteredGrades.filter(g => g.subject_id === subjectFilter);
  }

  if (semesterFilter !== 'all') {
    filteredGrades = filteredGrades.filter(g => g.semester === parseInt(semesterFilter));
  }

  // Stats
  const totalStudents = new Set(filteredGrades.map(g => g.student_id)).size;
  const passingGrades = filteredGrades.filter(g => Number(g.grade) >= 75);
  const passingRate = filteredGrades.length > 0 
    ? (passingGrades.length / filteredGrades.length) * 100 
    : 0;
  const avgGrade = filteredGrades.length > 0
    ? filteredGrades.reduce((sum, g) => sum + Number(g.grade), 0) / filteredGrades.length
    : 0;

  // Subject performance
  const subjectPerformance = mySubjects.map(subject => {
    const subjectGrades = filteredGrades.filter(g => g.subject_id === subject.id);
    const avg = subjectGrades.length > 0
      ? subjectGrades.reduce((sum, g) => sum + Number(g.grade), 0) / subjectGrades.length
      : 0;
    return {
      subject: subject.name,
      avgGrade: Math.round(avg * 100) / 100,
      studentCount: new Set(subjectGrades.map(g => g.student_id)).size
    };
  });

  // Quarterly performance
  const quarterlyData = [1, 2, 3, 4].map(q => {
    const quarterGrades = filteredGrades.filter(g => g.quarter === q);
    const avg = quarterGrades.length > 0
      ? quarterGrades.reduce((sum, g) => sum + Number(g.grade), 0) / quarterGrades.length
      : 0;
    return {
      quarter: `Q${q}`,
      avgGrade: Math.round(avg * 100) / 100
    };
  });

  // Grade distribution
  const gradeRanges = [
    { range: '90-100', min: 90, max: 100, count: 0 },
    { range: '85-89', min: 85, max: 89, count: 0 },
    { range: '80-84', min: 80, max: 84, count: 0 },
    { range: '75-79', min: 75, max: 79, count: 0 },
    { range: 'Below 75', min: 0, max: 74, count: 0 },
  ];

  filteredGrades.forEach(g => {
    const grade = Number(g.grade);
    gradeRanges.forEach(r => {
      if (grade >= r.min && grade <= r.max) r.count++;
    });
  });

  // Student performance - per subject evaluation (respects filters)
  const studentGradesMap = new Map();
  filteredGrades.forEach(g => {
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

  const topPerformers = studentPerformance.filter(s => !s.needsAttention).slice(0, 5);
  const strugglingStudents = studentPerformance.filter(s => s.needsAttention).slice(0, 5);

  const mockTrend = [
    { month: 'Jan', avgGrade: avgGrade - 5 || 75 },
    { month: 'Feb', avgGrade: avgGrade - 3 || 77 },
    { month: 'Mar', avgGrade: avgGrade || 80 },
    { month: 'Apr', avgGrade: avgGrade + 2 || 82 },
    { month: 'May', avgGrade: avgGrade + 1 || 83 },
    { month: 'Jun', avgGrade: avgGrade || 84 },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Analytics</h1>
          <p className="text-gray-400 mt-2">Performance insights for your subjects</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
          <StatCard
            title="Total Grades"
            value={filteredGrades.length}
            icon={<BookOpen size={24} />}
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Subjects' },
              ...mySubjects.map(s => ({ value: s.id, label: s.name }))
            ]}
          />
          <Select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Semesters' },
              { value: '1', label: 'First Semester' },
              { value: '2', label: 'Second Semester' }
            ]}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-xl font-semibold text-white mb-4">Grade Distribution</h3>
            <GradeDistributionChart data={gradeRanges.map(r => ({ range: r.range, count: r.count }))} />
          </Card>

          <Card>
            <h3 className="text-xl font-semibold text-white mb-4">Subject Comparison</h3>
            <SubjectComparisonChart data={subjectPerformance} />
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-xl font-semibold text-white mb-4">Quarterly Performance</h3>
            <QuarterlyPerformanceChart data={quarterlyData} />
          </Card>

          <Card>
            <h3 className="text-xl font-semibold text-white mb-4">Performance Trend</h3>
            <PerformanceTrendChart data={mockTrend} />
          </Card>
        </div>

        {/* Student Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Award className="text-yellow-400" size={24} />
              Top Performers
            </h3>
            <Table headers={['Student', 'Average Grade', 'Status']}>
              {topPerformers.map(({ student, avgGrade }) => (
                <tr key={student.id} className="hover:bg-white/5">
                  <td className="px-4 py-3 text-white">
                    {student.first_name} {student.last_name}
                  </td>
                  <td className="px-4 py-3 text-indigo-300 font-semibold">
                    {avgGrade.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="success">Excellent</Badge>
                  </td>
                </tr>
              ))}
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
                  .map((ws: any) => `${ws.subject.name} (${ws.avgGrade.toFixed(1)})`)
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

export default TeacherAnalytics;
