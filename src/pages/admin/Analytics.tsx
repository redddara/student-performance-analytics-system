import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { DashboardLayout } from '../../components/layouts';
import { Card, StatCard, Button, Select, Table, Badge } from '../../components/ui';
import { 
  GradeDistributionChart, 
  PassingRateChart, 
  PerformanceTrendChart,
  SubjectComparisonChart,
  QuarterlyPerformanceChart 
} from '../../components/charts';
import { 
  Users, 
  BookOpen, 
  GraduationCap, 
  TrendingUp,
  TrendingDown,
  Award,
  AlertTriangle
} from 'lucide-react';

const AdminAnalytics: React.FC = () => {
  const { analytics, subjects, grades, students, fetchAnalytics, calculateGWA, fetchGrades, fetchSubjects, fetchStudents } = useStore();
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeData = async () => {
      try {
        // Fetch all required data first
        await Promise.all([
          fetchStudents(),
          fetchSubjects(),
          fetchGrades()
        ]);
      } catch (err) {
        console.error('Error fetching initial data:', err);
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, []);

  useEffect(() => {
    // Recalculate analytics whenever data changes
    if (grades.length > 0 || students.length > 0) {
      fetchAnalytics();
    }
  }, [subjects, grades, students, fetchGrades, fetchSubjects, fetchStudents, fetchAnalytics]);

  const mockPerformanceTrend = [
    { month: 'Jan', avgGrade: 78 },
    { month: 'Feb', avgGrade: 80 },
    { month: 'Mar', avgGrade: 82 },
    { month: 'Apr', avgGrade: 79 },
    { month: 'May', avgGrade: 85 },
    { month: 'Jun', avgGrade: 87 },
  ];

  // Calculate subject averages
  const subjectAverages = subjects.map(subject => {
    const subjectGrades = grades.filter(g => g.subject_id === subject.id);
    const avg = subjectGrades.length > 0 
      ? subjectGrades.reduce((sum, g) => sum + Number(g.grade), 0) / subjectGrades.length 
      : 0;
    return {
      subject: subject.name,
      avgGrade: Math.round(avg * 100) / 100,
      studentCount: subjectGrades.length
    };
  });

  // Quarterly performance
  const quarterlyData = [1, 2, 3, 4].map(q => {
    const quarterGrades = grades.filter(g => g.quarter === q);
    const avg = quarterGrades.length > 0
      ? quarterGrades.reduce((sum, g) => sum + Number(g.grade), 0) / quarterGrades.length
      : 0;
    return {
      quarter: `Q${q}`,
      avgGrade: Math.round(avg * 100) / 100
    };
  });

  // Get top and struggling students
  const studentPerformance = students.map(student => ({
    student,
    gwa: calculateGWA(student.id)
  })).sort((a, b) => b.gwa - a.gwa);

  const topPerformers = studentPerformance.slice(0, 5);
  const strugglingStudents = studentPerformance.filter(s => s.gwa < 75).slice(0, 5);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Analytics Dashboard</h1>
          <p className="text-gray-400 mt-2">Comprehensive academic performance insights</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading analytics data...</p>
          </div>
        ) : (
          <>
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Students"
            value={students.length}
            icon={<GraduationCap size={24} />}
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            title="Average GWA"
            value={analytics?.averageGWA?.toFixed(2) || '0.00'}
            icon={<TrendingUp size={24} />}
            trend={{ value: 3.2, isPositive: true }}
          />
          <StatCard
            title="Passing Rate"
            value={`${analytics?.passingRate?.toFixed(1) || 0}%`}
            icon={<Award size={24} />}
            trend={{ value: 5, isPositive: true }}
          />
          <StatCard
            title="Failing Rate"
            value={`${analytics?.failingRate?.toFixed(1) || 0}%`}
            icon={<AlertTriangle size={24} />}
            trend={{ value: 2, isPositive: false }}
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Subjects' },
              ...subjects.map(s => ({ value: s.id, label: s.name }))
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

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-xl font-semibold text-white mb-4">Grade Distribution</h3>
            <GradeDistributionChart data={analytics?.gradeDistribution || []} />
          </Card>

          <Card>
            <h3 className="text-xl font-semibold text-white mb-4">Passing vs Failing</h3>
            <PassingRateChart passingRate={analytics?.passingRate || 0} failingRate={analytics?.failingRate || 0} />
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-xl font-semibold text-white mb-4">Subject Performance Comparison</h3>
            <SubjectComparisonChart data={subjectAverages} />
          </Card>

          <Card>
            <h3 className="text-xl font-semibold text-white mb-4">Quarterly Performance</h3>
            <QuarterlyPerformanceChart data={quarterlyData} />
          </Card>
        </div>

        {/* Performance Trend */}
        <Card>
          <h3 className="text-xl font-semibold text-white mb-4">Overall Performance Trend</h3>
          <PerformanceTrendChart data={mockPerformanceTrend} />
        </Card>

        {/* Student Performance Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Performers */}
          <Card>
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Award className="text-yellow-400" size={24} />
              Top Performers
            </h3>
            <Table headers={['Student', 'GWA', 'Status']}>
              {topPerformers.map(({ student, gwa }) => (
                <tr key={student.id} className="hover:bg-white/5">
                  <td className="px-4 py-3 text-white">
                    {student.first_name} {student.last_name}
                  </td>
                  <td className="px-4 py-3 text-indigo-300 font-semibold">
                    {gwa.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="success">Excellent</Badge>
                  </td>
                </tr>
              ))}
            </Table>
          </Card>

          {/* Struggling Students */}
          <Card>
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="text-red-400" size={24} />
              Needs Attention
            </h3>
            <Table headers={['Student', 'GWA', 'Status']}>
              {strugglingStudents.length > 0 ? strugglingStudents.map(({ student, gwa }) => (
                <tr key={student.id} className="hover:bg-white/5">
                  <td className="px-4 py-3 text-white">
                    {student.first_name} {student.last_name}
                  </td>
                  <td className="px-4 py-3 text-red-300 font-semibold">
                    {gwa.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="danger">At Risk</Badge>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                    No struggling students found
                  </td>
                </tr>
              )}
            </Table>
          </Card>
        </div>
        </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminAnalytics;
