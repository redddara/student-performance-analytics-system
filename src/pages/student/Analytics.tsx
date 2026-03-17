import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { DashboardLayout } from '../../components/layouts';
import { Card, StatCard, Select, Badge } from '../../components/ui';
import { 
  GradeDistributionChart, 
  StudentProgressChart,
  PassingRateChart,
  PerformanceTrendChart
} from '../../components/charts';
import { 
  BookOpen, 
  GraduationCap, 
  TrendingUp,
  Award,
  AlertTriangle,
  Star,
  Target,
  Calendar
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const StudentAnalytics: React.FC = () => {
  const { user, subjects } = useStore();
  const [myGrades, setMyGrades] = useState<any[]>([]);
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyGrades();
  }, [user, subjects]);

  const fetchMyGrades = async () => {
    if (!user) return;
    setLoading(true);

    const { data: studentData } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (studentData) {
      const { data: grades } = await supabase
        .from('grades')
        .select('*, subject:subjects(*)')
        .eq('student_id', studentData.id)
        .order('created_at', { ascending: false });

      if (grades) setMyGrades(grades);
    }
    setLoading(false);
  };

  // Filter grades
  let filteredGrades = myGrades;
  if (semesterFilter !== 'all') {
    filteredGrades = myGrades.filter(g => g.semester === parseInt(semesterFilter));
  }

  // Calculate GWA
  const gwa = filteredGrades.length > 0
    ? filteredGrades.reduce((sum, g) => sum + Number(g.grade), 0) / filteredGrades.length
    : 0;

  // Passing rate
  const passingCount = filteredGrades.filter(g => Number(g.grade) >= 75).length;
  const passingRate = filteredGrades.length > 0 
    ? (passingCount / filteredGrades.length) * 100 
    : 0;

  // Subject performance
  const subjectGrades = new Map();
  filteredGrades.forEach(g => {
    if (!subjectGrades.has(g.subject_id)) {
      subjectGrades.set(g.subject_id, []);
    }
    subjectGrades.get(g.subject_id).push(g);
  });

  const subjectPerformance = Array.from(subjectGrades.entries()).map(([subjectId, subjectGradesList]: [string, any]) => {
    const subject = subjects.find(s => s.id === subjectId);
    const avg = subjectGradesList.reduce((sum: number, g: any) => sum + Number(g.grade), 0) / subjectGradesList.length;
    const semester = subjectGradesList[0]?.semester;
    return {
      subject: subject?.name || 'Unknown',
      grade: Math.round(avg * 100) / 100,
      semester
    };
  }).sort((a, b) => b.grade - a.grade);

  // Best and weakest
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

  filteredGrades.forEach(g => {
    const grade = Number(g.grade);
    gradeRanges.forEach(r => {
      if (grade >= r.min && grade <= r.max) r.count++;
    });
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

  // Progress trend (mock data based on actual)
  const progressData = [
    { month: 'Q1', avgGrade: quarterlyData[0]?.avgGrade || 80 },
    { month: 'Q2', avgGrade: quarterlyData[1]?.avgGrade || 82 },
    { month: 'Q3', avgGrade: quarterlyData[2]?.avgGrade || gwa },
    { month: 'Q4', avgGrade: quarterlyData[3]?.avgGrade || gwa + 1 },
  ];

  // Strengths and weaknesses
  const strengths = subjectPerformance.filter(s => s.grade >= 80).map(s => s.subject);
  const weaknesses = subjectPerformance.filter(s => s.grade < 75).map(s => s.subject);

  const getStatus = () => {
    if (gwa >= 90) return { label: 'With Honors', variant: 'success' as const };
    if (gwa >= 85) return { label: 'Excellent', variant: 'success' as const };
    if (gwa >= 80) return { label: 'Very Good', variant: 'info' as const };
    if (gwa >= 75) return { label: 'Passing', variant: 'warning' as const };
    return { label: 'Needs Improvement', variant: 'danger' as const };
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-white">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">My Analytics</h1>
          <p className="text-gray-400 mt-2">Track your academic progress and performance insights</p>
        </div>

        {/* Filter */}
        <Select
          value={semesterFilter}
          onChange={(e) => setSemesterFilter(e.target.value)}
          options={[
            { value: 'all', label: 'All Semesters' },
            { value: '1', label: 'First Semester' },
            { value: '2', label: 'Second Semester' }
          ]}
        />

        {/* Main Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="GWA"
            value={gwa.toFixed(2)}
            icon={<TrendingUp size={24} />}
          />
          <StatCard
            title="Passing Rate"
            value={`${passingRate.toFixed(0)}%`}
            icon={<Award size={24} />}
          />
          <StatCard
            title="Subjects"
            value={subjectPerformance.length}
            icon={<BookOpen size={24} />}
          />
          <StatCard
            title="Total Grades"
            value={filteredGrades.length}
            icon={<GraduationCap size={24} />}
          />
        </div>

        {/* Best/Worst Performance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Star className="text-yellow-400" size={24} />
              Strengths
            </h3>
            {strengths.length > 0 ? (
              <div className="space-y-2">
                {strengths.map((subject, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <span className="text-white">{subject}</span>
                    <Badge variant="success">Strong</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400">No strong subjects yet</p>
            )}
          </Card>

          <Card>
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Target className="text-red-400" size={24} />
              Areas for Improvement
            </h3>
            {weaknesses.length > 0 ? (
              <div className="space-y-2">
                {weaknesses.map((subject, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <span className="text-white">{subject}</span>
                    <Badge variant="danger">Needs Work</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400">No weak subjects - keep it up!</p>
            )}
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-xl font-semibold text-white mb-4">Grade Distribution</h3>
            <GradeDistributionChart data={gradeRanges.map(r => ({ range: r.range, count: r.count }))} />
          </Card>

          <Card>
            <h3 className="text-xl font-semibold text-white mb-4">Subject Performance</h3>
            <StudentProgressChart data={subjectPerformance} />
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-xl font-semibold text-white mb-4">Quarterly Progress</h3>
            <PerformanceTrendChart data={progressData} />
          </Card>

          <Card>
            <h3 className="text-xl font-semibold text-white mb-4">Passing Status</h3>
            <PassingRateChart passingRate={passingRate} failingRate={100 - passingRate} />
          </Card>
        </div>

        {/* Subject Breakdown */}
        <Card>
          <h3 className="text-xl font-semibold text-white mb-4">Subject Breakdown</h3>
          <div className="space-y-3">
            {subjectPerformance.map((sp, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-300">
                    <BookOpen size={18} />
                  </div>
                  <div>
                    <p className="text-white font-medium">{sp.subject}</p>
                    <p className="text-gray-400 text-sm">Semester {sp.semester}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${
                    sp.grade >= 75 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {sp.grade.toFixed(2)}
                  </p>
                  <Badge variant={sp.grade >= 75 ? 'success' : 'danger'}>
                    {sp.grade >= 75 ? 'Passed' : 'Failed'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StudentAnalytics;
