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

  // Student performance for my subjects
  const studentGradesMap = new Map();
  mySubjectGrades.forEach(g => {
    if (!studentGradesMap.has(g.student_id)) {
      studentGradesMap.set(g.student_id, []);
    }
    studentGradesMap.get(g.student_id).push(g);
  });

  const studentPerformance = Array.from(studentGradesMap.entries()).map(([studentId, studentGrades]: [string, any]) => {
    const student = students.find(s => s.id === studentId);
    const avg = studentGrades.reduce((sum: number, g: any) => sum + Number(g.grade), 0) / studentGrades.length;
    return {
      student,
      avgGrade: Math.round(avg * 100) / 100
    };
  }).sort((a, b) => b.avgGrade - a.avgGrade);

  const topPerformers = studentPerformance.slice(0, 5);
  const strugglingStudents = studentPerformance.filter(s => s.avgGrade < 75).slice(0, 5);

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
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Award className="text-yellow-400" size={24} />
              Top Performers
            </h3>
            <Table headers={['Student', 'Average Grade', 'Status']}>
              {topPerformers.map(({ student, avgGrade }) => (
                <tr key={student?.id} className="hover:bg-white/5">
                  <td className="px-4 py-3 text-white">
                    {student?.first_name} {student?.last_name}
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
            <Table headers={['Student', 'Average Grade', 'Status']}>
              {strugglingStudents.length > 0 ? strugglingStudents.map(({ student, avgGrade }) => (
                <tr key={student?.id} className="hover:bg-white/5">
                  <td className="px-4 py-3 text-white">
                    {student?.first_name} {student?.last_name}
                  </td>
                  <td className="px-4 py-3 text-red-300 font-semibold">
                    {avgGrade.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="danger">At Risk</Badge>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                    No struggling students
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
