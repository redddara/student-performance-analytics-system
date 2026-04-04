import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Select, Spinner } from '../../components/ui';
import { useDataStore } from '../../store';
import { supabase, isPassing, calculateGWA } from '../../lib/supabase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, AreaChart, Area, ComposedChart
} from 'recharts';

export default function AdminAnalyticsPage() {
  const { subjects, students, grades, courses } = useDataStore();
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Trigger animations after data loads
    setTimeout(() => setAnimated(true), 100);
  }, [loading]);

  const loadData = async () => {
    try {
      const [subjectsRes, studentsRes, gradesRes, coursesRes] = await Promise.all([
        supabase.from('subjects').select('*, course:courses(*)'),
        supabase.from('students').select('*, course:courses(*)'),
        supabase.from('grades').select('*'),
        supabase.from('courses').select('*'),
      ]);
      
      useDataStore.getState().setSubjects(subjectsRes.data || []);
      useDataStore.getState().setStudents(studentsRes.data || []);
      useDataStore.getState().setGrades(gradesRes.data || []);
      useDataStore.getState().setCourses(coursesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <DashboardLayout title="Analytics"><Spinner size="lg" /></DashboardLayout>;
  }

  const filteredStudents = selectedCourse === 'all' ? students : students.filter(s => s.course_id === selectedCourse);

  // Grade Distribution
  const gradeDistribution = [0, 0, 0, 0, 0];
  grades.forEach(g => {
    if (g.grade >= 90) gradeDistribution[0]++;
    else if (g.grade >= 85) gradeDistribution[1]++;
    else if (g.grade >= 80) gradeDistribution[2]++;
    else if (g.grade >= 75) gradeDistribution[3]++;
    else gradeDistribution[4]++;
  });

  const pieData = [
    { name: 'Excellent (90+)', value: gradeDistribution[0], color: '#800000' },
    { name: 'Very Good (85-89)', value: gradeDistribution[1], color: '#d4af37' },
    { name: 'Good (80-84)', value: gradeDistribution[2], color: '#4CAF50' },
    { name: 'Passing (75-79)', value: gradeDistribution[3], color: '#2196F3' },
    { name: 'Failed (<75)', value: gradeDistribution[4], color: '#f44336' },
  ].filter(d => d.value > 0);

  // Pass/Fail Rate
  const passingCount = grades.filter(g => isPassing(g.grade)).length;
  const passFailData = [
    { name: 'Passing', value: passingCount, color: '#4CAF50' },
    { name: 'Failing', value: grades.length - passingCount, color: '#f44336' },
  ];

  // Subject Performance
  const subjectPerformance = subjects.map(sub => {
    const subjectGrades = grades.filter(g => g.subject_id === sub.id);
    const avg = subjectGrades.length > 0 ? Math.round(subjectGrades.reduce((sum, g) => sum + g.grade, 0) / subjectGrades.length * 100) / 100 : 0;
    return { name: sub.name.length > 15 ? sub.name.substring(0, 15) + '...' : sub.name, average: avg, students: subjectGrades.length };
  }).filter(s => s.students > 0).slice(0, 10);

  // Quarterly Trends
  const quarterlyData = [1, 2, 3, 4].map(q => {
    const qGrades = grades.filter(g => g.quarter === q);
    return { quarter: `Q${q}`, average: qGrades.length > 0 ? Math.round(qGrades.reduce((sum, g) => sum + g.grade, 0) / qGrades.length * 100) / 100 : 0, passing: qGrades.filter(g => isPassing(g.grade)).length, total: qGrades.length };
  });

  // Year Level Performance
  const yearLevelData = ['1st', '2nd', '3rd', '4th'].map(year => {
    const yearSubjects = subjects.filter(s => s.year_level === year);
    const yearGrades = grades.filter(g => yearSubjects.find(s => s.id === g.subject_id));
    return { year: `${year} Year`, average: yearGrades.length > 0 ? Math.round(yearGrades.reduce((sum, g) => sum + g.grade, 0) / yearGrades.length * 100) / 100 : 0, count: yearGrades.length };
  });

  // Course Comparison
  const courseComparison = courses.map(course => {
    const courseSubjects = subjects.filter(s => s.course_id === course.id);
    const courseGrades = grades.filter(g => courseSubjects.find(s => s.id === g.subject_id));
    return { name: course.name.substring(0, 12), average: courseGrades.length > 0 ? Math.round(courseGrades.reduce((sum, g) => sum + g.grade, 0) / courseGrades.length * 100) / 100 : 0 };
  });

  // Top Performers
  const topPerformers = filteredStudents.map(student => {
    const studentGrades = grades.filter(g => g.student_id === student.id);
    return { name: `${student.first_name} ${student.last_name}`.substring(0, 15), gwa: calculateGWA(studentGrades), grades: studentGrades.length };
  }).filter(s => s.grades > 0).sort((a, b) => b.gwa - a.gwa).slice(0, 5);

  // Grade Heatmap Data (by quarter and subject)
  const quarterSubjectData = [1, 2, 3, 4].map(q => {
    const qGrades = grades.filter(g => g.quarter === q);
    return { quarter: `Q${q}`, high: qGrades.filter(g => g.grade >= 85).length, mid: qGrades.filter(g => g.grade >= 75 && g.grade < 85).length, low: qGrades.filter(g => g.grade < 75).length };
  });

  const overallAverage = grades.length > 0 ? Math.round(grades.reduce((sum, g) => sum + g.grade, 0) / grades.length * 100) / 100 : 0;
  const passRate = grades.length > 0 ? Math.round((passingCount / grades.length) * 100) : 0;

  return (
    <DashboardLayout title="Analytics & Reports">
      <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
        <Select
          label="Filter by Course"
          value={selectedCourse}
          onChange={e => { setSelectedCourse(e.target.value); setAnimated(false); setTimeout(() => setAnimated(true), 100); }}
          options={[{ value: 'all', label: 'All Courses' }, ...courses.map(c => ({ value: c.id, label: c.name }))]}
          className="max-w-xs"
        />
        <div className="text-sm text-gray-500">
          Total Records: {grades.length} grades • {filteredStudents.length} students
        </div>
      </div>

      {/* Animated Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Students', value: filteredStudents.length, iconClass: 'hgi-people', color: '#800000' },
          { label: 'Total Subjects', value: subjects.length, iconClass: 'hgi-book-02', color: '#d4af37' },
          { label: 'Overall Pass Rate', value: `${passRate}%`, iconClass: 'hgi-checkmark-circle-02', color: '#4CAF50' },
          { label: 'Average Grade', value: overallAverage, iconClass: 'hgi-chart', color: '#2196F3' },
        ].map((stat, i) => (
          <GlassCard key={i} className={`p-4 text-center animate-delay-${i * 100} animate-in fade-in slide-in-from-bottom duration-500 opacity-100`}>
            <div className="text-3xl mb-2"><i className={`hgi-stroke ${stat.iconClass} text-xl`} style={{ color: stat.color }}></i></div>
            <p className="text-2xl font-bold text-[#800000]">{stat.value}</p>
            <p className="text-sm text-gray-600">{stat.label}</p>
          </GlassCard>
        ))}
      </div>

      {/* Row 1: Pie Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <GlassCard className="p-6 animate-delay-200 animate-in fade-in slide-in-from-left duration-500">
          <h3 className="text-lg font-semibold text-[#800000] mb-4 flex items-center gap-2">
            <span><i className="hgi-stroke hgi-trending-up text-xl"></i></span> Grade Distribution
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" labelLine={false} label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`} outerRadius={100} fill="#8884d8" dataKey="value" animationDuration={1500} animationBegin={300}>
                {pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} stroke="white" strokeWidth={2} />))}
              </Pie>
              <Tooltip formatter={(value) => [value, 'Students']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="p-6 animate-delay-300 animate-in fade-in slide-in-from-right duration-500">
          <h3 className="text-lg font-semibold text-[#800000] mb-4 flex items-center gap-2">
            <span><i className="hgi-stroke hgi-target-02 text-xl"></i></span> Pass/Fail Rate
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={passFailData} cx="50%" cy="50%" labelLine={false} label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`} innerRadius={60} outerRadius={100} fill="#8884d8" dataKey="value" animationDuration={1500} animationBegin={400}>
                {passFailData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} stroke="white" strokeWidth={2} />))}
              </Pie>
              <Tooltip formatter={(value) => [value, 'Students']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      {/* Row 2: Bar & Line Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <GlassCard className={`p-6 ${animated ? 'animate-in fade-in slide-in-from-left duration-500' : 'opacity-0'}`} style={{ animationDelay: '400ms' }}>
          <h3 className="text-lg font-semibold text-[#800000] mb-4 flex items-center gap-2">
            <span><i className="hgi-stroke hgi-chart text-xl"></i></span> Subject Performance
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={subjectPerformance} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis type="number" domain={[0, 100]} />
              <YAxis type="category" dataKey="name" width={100} />
              <Tooltip formatter={(value) => [value, 'Average']} />
              <Bar dataKey="average" fill="#800000" radius={[0, 4, 4, 0]} animationDuration={1500} animationBegin={500} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className={`p-6 ${animated ? 'animate-in fade-in slide-in-from-right duration-500' : 'opacity-0'}`} style={{ animationDelay: '500ms' }}>
          <h3 className="text-lg font-semibold text-[#800000] mb-4 flex items-center gap-2">
            <span><i className="hgi-stroke hgi-statistic-02 text-xl"></i></span> Quarterly Trend
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={quarterlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="quarter" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Area type="monotone" dataKey="average" stroke="#d4af37" fill="url(#gradient)" strokeWidth={2} animationDuration={1500} animationBegin={600} />
              <Area type="monotone" dataKey="passing" stroke="#4CAF50" fill="transparent" strokeWidth={2} />
              <Legend />
              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d4af37" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#d4af37" stopOpacity={0} />
                </linearGradient>
              </defs>
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      {/* Row 3: More Detailed Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <GlassCard className={`p-6 ${animated ? 'animate-in fade-in slide-in-from-bottom duration-500' : 'opacity-0'}`} style={{ animationDelay: '600ms' }}>
          <h3 className="text-lg font-semibold text-[#800000] mb-4 flex items-center gap-2">
            <span><i className="hgi-stroke hgi-graduation-cap text-xl"></i></span> Year Level Performance
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={yearLevelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="year" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="average" fill="#800000" radius={[4, 4, 0, 0]} animationDuration={1500} />
            </ComposedChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className={`p-6 ${animated ? 'animate-in fade-in slide-in-from-bottom duration-500' : 'opacity-0'}`} style={{ animationDelay: '700ms' }}>
          <h3 className="text-lg font-semibold text-[#800000] mb-4 flex items-center gap-2">
            <span><i className="hgi-stroke hgi-school text-xl"></i></span> Course Comparison
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={courseComparison}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="average" fill="#d4af37" radius={[4, 4, 0, 0]} animationDuration={1500} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className={`p-6 ${animated ? 'animate-in fade-in slide-in-from-bottom duration-500' : 'opacity-0'}`} style={{ animationDelay: '800ms' }}>
          <h3 className="text-lg font-semibold text-[#800000] mb-4 flex items-center gap-2">
            <span><i className="hgi-stroke hgi-clipboard text-xl"></i></span> Grade by Quarter
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={quarterSubjectData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="quarter" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="high" stackId="a" fill="#4CAF50" name="High (85+)" />
              <Bar dataKey="mid" stackId="a" fill="#2196F3" name="Mid (75-84)" />
              <Bar dataKey="low" stackId="a" fill="#f44336" name="Low (<75)" />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      {/* Top Performers */}
      {topPerformers.length > 0 && (
        <GlassCard className={`p-6 ${animated ? 'animate-in fade-in duration-500' : 'opacity-0'}`} style={{ animationDelay: '900ms' }}>
          <h3 className="text-lg font-semibold text-[#800000] mb-4 flex items-center gap-2">
            <span>🏆</span> Top Performers
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {topPerformers.map((student, i) => (
              <div key={i} className="text-center p-4 rounded-xl bg-gradient-to-br from-[#800000]/10 to-[#d4af37]/10 border border-[#800000]/20">
{i === 0 ? <i className="hgi-stroke hgi-trophy text-2xl text-gold-500"/> : i === 1 ? <i className="hgi-stroke hgi-award-01 text-xl text-gold-400"/> : i === 2 ? <i className="hgi-stroke hgi-award-02 text-lg text-gold-300"/> : <i className="hgi-stroke hgi-star text-lg text-gold-400"/>}
                <p className="font-semibold text-gray-800 text-sm">{student.name}</p>
                <p className="text-xl font-bold text-[#800000]">{student.gwa.toFixed(2)}</p>
                <p className="text-xs text-gray-500">{student.grades} subjects</p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </DashboardLayout>
  );
}