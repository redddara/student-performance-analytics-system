import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { DashboardLayout } from '../../components/layouts';
import { Card, StatCard, Badge, Table } from '../../components/ui';
import { 
  GradeDistributionChart, 
  StudentProgressChart,
  PassingRateChart 
} from '../../components/charts';
import { 
  BookOpen, 
  GraduationCap, 
  TrendingUp,
  Award,
  AlertTriangle,
  Star,
  Target
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const StudentDashboard: React.FC = () => {
  const { user, subjects, grades, students, studentSubjects, fetchStudentSubjects } = useStore();
  const [myEnrollments, setMyEnrollments] = useState<any[]>([]);
  const [myGrades, setMyGrades] = useState<any[]>([]);

  useEffect(() => {
    fetchMyData();
  }, [user, subjects, grades, studentSubjects]);

  const fetchMyData = async () => {
    if (!user) return;

    // Get current student's record
    const { data: studentData } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (studentData) {
      // Get enrollments
      const { data: enrollments } = await supabase
        .from('student_subjects')
        .select('*, subject:subjects(*, course:courses(*))')
        .eq('student_id', studentData.id);

      if (enrollments) setMyEnrollments(enrollments);

      // Get grades
      const { data: studentGrades } = await supabase
        .from('grades')
        .select('*, subject:subjects(*)')
        .eq('student_id', studentData.id);

      if (studentGrades) setMyGrades(studentGrades);
    }
  };

  // Calculate GWA
  const gwa = myGrades.length > 0
    ? myGrades.reduce((sum, g) => sum + Number(g.grade), 0) / myGrades.length
    : 0;

  // Passing rate
  const passingCount = myGrades.filter(g => Number(g.grade) >= 75).length;
  const passingRate = myGrades.length > 0 
    ? (passingCount / myGrades.length) * 100 
    : 0;

  // Get best and weakest subjects
  const subjectGrades = new Map();
  myGrades.forEach(g => {
    if (!subjectGrades.has(g.subject_id)) {
      subjectGrades.set(g.subject_id, []);
    }
    subjectGrades.get(g.subject_id).push(g);
  });

  const subjectPerformance = Array.from(subjectGrades.entries()).map(([subjectId, subjectGradesList]: [string, any]) => {
    const subject = subjects.find(s => s.id === subjectId);
    const avg = subjectGradesList.reduce((sum: number, g: any) => sum + Number(g.grade), 0) / subjectGradesList.length;
    return {
      subject: subject?.name || 'Unknown',
      grade: Math.round(avg * 100) / 100
    };
  }).sort((a, b) => b.grade - a.grade);

  const bestSubject = subjectPerformance[0];
  const weakestSubject = subjectPerformance[subjectPerformance.length - 1];

  // Grade distribution
  const gradeRanges = [
    { range: '90-100', min: 90, max: 100, count: 0 },
    { range: '85-89', min: 85, max: 89, count: 0 },
    { range: '80-84', min: 80, max: 84, count: 0 },
    { range: '75-79', min: 75, max: 79, count: 0 },
    { range: 'Below 75', min: 0, max: 74, count: 0 },
  ];

  myGrades.forEach(g => {
    const grade = Number(g.grade);
    gradeRanges.forEach(r => {
      if (grade >= r.min && grade <= r.max) r.count++;
    });
  });

  const getStatus = () => {
    if (gwa >= 90) return { label: 'With Honors', variant: 'success' as const };
    if (gwa >= 85) return { label: 'Excellent', variant: 'info' as const };
    if (gwa >= 80) return { label: 'Very Good', variant: 'info' as const };
    if (gwa >= 75) return { label: 'Passing', variant: 'warning' as const };
    return { label: 'Needs Improvement', variant: 'danger' as const };
  };

  const status = getStatus();

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Student Dashboard</h1>
          <p className="text-gray-400 mt-2">Welcome back, {user?.name}</p>
        </div>

        {/* GWA Card */}
        <Card className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border-indigo-500/30">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <p className="text-gray-300 text-lg">General Weighted Average</p>
              <p className="text-6xl font-bold text-white mt-2">{gwa.toFixed(2)}</p>
              <Badge variant={status.variant} className="mt-3">{status.label}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                title="Subjects"
                value={myEnrollments.length}
                icon={<BookOpen size={24} />}
              />
              <StatCard
                title="Passing Rate"
                value={`${passingRate.toFixed(0)}%`}
                icon={<TrendingUp size={24} />}
              />
            </div>
          </div>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center text-green-300">
                <Star size={24} />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Best Subject</p>
                <p className="text-white font-semibold">{bestSubject?.subject || '-'}</p>
                <p className="text-green-400 font-bold">{bestSubject?.grade?.toFixed(2) || '-'}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center text-red-300">
                <Target size={24} />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Needs Improvement</p>
                <p className="text-white font-semibold">{weakestSubject?.subject || '-'}</p>
                <p className="text-red-400 font-bold">{weakestSubject?.grade?.toFixed(2) || '-'}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-300">
                <Award size={24} />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Total Grades</p>
                <p className="text-white font-semibold">{myGrades.length}</p>
                <p className="text-blue-400 font-bold">Recorded</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-xl font-semibold text-white mb-4">Grade Distribution</h3>
            <GradeDistributionChart data={gradeRanges.map(r => ({ range: r.range, count: r.count }))} />
          </Card>

          <Card>
            <h3 className="text-xl font-semibold text-white mb-4">Passing Status</h3>
            <PassingRateChart passingRate={passingRate} failingRate={100 - passingRate} />
          </Card>
        </div>

        {/* Recent Grades */}
        <Card>
          <h3 className="text-xl font-semibold text-white mb-4">Recent Grades</h3>
          <Table headers={['Subject', 'Grade', 'Quarter', 'Semester', 'Status']}>
            {myGrades.slice(0, 5).map(grade => (
              <tr key={grade.id} className="hover:bg-white/5">
                <td className="px-4 py-3 text-white">
                  {grade.subject?.name || 'Unknown'}
                </td>
                <td className="px-4 py-3 text-xl font-bold text-white">
                  {grade.grade}
                </td>
                <td className="px-4 py-3 text-gray-300">Q{grade.quarter}</td>
                <td className="px-4 py-3 text-gray-300">Sem {grade.semester}</td>
                <td className="px-4 py-3">
                  <Badge variant={Number(grade.grade) >= 75 ? 'success' : 'danger'}>
                    {Number(grade.grade) >= 75 ? 'Passed' : 'Failed'}
                  </Badge>
                </td>
              </tr>
            ))}
          </Table>
          {myGrades.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No grades recorded yet
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
