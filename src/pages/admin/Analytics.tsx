import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageIntro } from '../../components/layouts/PageIntro';
import { GlassCard, Select, Button, PageSkeletonLoader } from '../../components/ui';
import { useDataStore, useAuthStore } from '../../store';
import { supabase, isPassing, toGradePoint, getRemarkCategory, formatGwa } from '../../lib/supabase';
import { useSupabaseLiveReload } from '../../lib/useSupabaseLiveReload';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, AreaChart, Area, ComposedChart
} from 'recharts';
import { Users, BarChart3, TrendingUp, GraduationCap, BookOpen, CheckCircle2, ChartLine, Trophy, RefreshCw, ListFilter } from 'lucide-react';
import { chartAxis, chartGrid, chartLegend, chartTooltip } from '../../lib/chartTheme';
import { formatPersonDisplayName } from '../../lib/personName';
import { compareNumeric, sortByName, sortSelectOptions } from '../../lib/sortUtils';
import {
  buildSubjectPassFailData,
  averageSubjectFinalGradePoint,
  calculateGwaFromSubjectFinals,
  collectSubjectFinalGradePoints,
  fetchActiveSchoolYear,
  isStudentPassingBySubjectFinals,
} from '../../lib/analyticsData';

export default function AdminAnalyticsPage() {
  const { user } = useAuthStore();
  const { subjects, students, grades, courses } = useDataStore();
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [animated, setAnimated] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeSchoolYearName, setActiveSchoolYearName] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      const activeSy = await fetchActiveSchoolYear();
      setActiveSchoolYearName(activeSy?.name || '');

      const [subjectsRes, studentsRes, gradesRes, coursesRes] = await Promise.all([
        supabase.from('subjects').select('*, course:courses(*)').order('name', { ascending: true }),
        supabase.from('students').select('*, course:courses(*)').order('last_name', { ascending: true }),
        (async () => {
          let q = supabase.from('grades').select('*');
          if (activeSy?.id) q = q.eq('school_year_id', activeSy.id);
          return q;
        })(),
        supabase.from('courses').select('*').order('name', { ascending: true }),
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
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useSupabaseLiveReload(
    loadData,
    user?.id ? `live:admin-analytics:${user.id}` : null,
    ['subjects', 'students', 'grades', 'courses', 'school_years', 'student_subjects']
  );

  useEffect(() => {
    const t = window.setTimeout(() => setAnimated(true), 100);
    return () => window.clearTimeout(t);
  }, [loading]);

  if (loading) {
    return <DashboardLayout title="Analytics"><PageSkeletonLoader rows={5} /></DashboardLayout>;
  }

  const filteredStudents = selectedCourse === 'all' ? students : students.filter(s => s.course_id === selectedCourse);
  const filteredStudentIds = new Set(filteredStudents.map((s) => s.id));
  const filteredGrades = grades.filter((g) => filteredStudentIds.has(g.student_id));

  const remarkBuckets: Record<string, number> = {
    EXCELLENT: 0,
    'VERY GOOD': 0,
    SATISFACTORY: 0,
    FAIR: 0,
    'FAILED OR CONDITIONAL': 0,
  };
  filteredGrades.forEach((g) => {
    if (g.grade_status === 'inc') return;
    const cat = getRemarkCategory(toGradePoint(Number(g.grade)));
    remarkBuckets[cat] = (remarkBuckets[cat] || 0) + 1;
  });

  const pieData = [
    { name: 'Excellent', value: remarkBuckets.EXCELLENT, color: '#800000' },
    { name: 'Very Good', value: remarkBuckets['VERY GOOD'], color: '#d4af37' },
    { name: 'Satisfactory', value: remarkBuckets.SATISFACTORY, color: '#4CAF50' },
    { name: 'Fair', value: remarkBuckets.FAIR, color: '#2196F3' },
    { name: 'Failed / Conditional', value: remarkBuckets['FAILED OR CONDITIONAL'], color: '#f44336' },
  ].filter((d) => d.value > 0);

  // Pass/Fail Rate
  const studentPassRows = filteredStudents.map((student) => {
    const studentGrades = filteredGrades.filter((g) => g.student_id === student.id);
    return {
      studentId: student.id,
      gwa: calculateGwaFromSubjectFinals(studentGrades),
      passing: isStudentPassingBySubjectFinals(studentGrades),
      count: studentGrades.length,
    };
  }).filter((row) => row.count > 0);
  const passingCount = studentPassRows.filter((row) => row.passing).length;
  const passFailData = [
    { name: 'Passing', value: passingCount, color: '#4CAF50' },
    { name: 'Failing', value: studentPassRows.length - passingCount, color: '#f44336' },
  ];

  // Subject Performance
  const subjectPerformance = subjects.map(sub => {
    const subjectGrades = filteredGrades.filter(g => g.subject_id === sub.id);
    const avg = subjectGrades.length > 0 ? averageSubjectFinalGradePoint(subjectGrades) : 0;
    return { name: sub.name.length > 15 ? sub.name.substring(0, 15) + '...' : sub.name, average: avg, students: subjectGrades.length };
  }).filter(s => s.students > 0 && s.average > 0).slice(0, 10);

  // Quarterly Trends
  const quarterlyData = [1, 2, 3, 4].map(q => {
    const qGrades = filteredGrades.filter(g => g.quarter === q);
    const byStudent = new Map<string, number[]>();
    qGrades.forEach((grade) => {
      const list = byStudent.get(grade.student_id) || [];
      list.push(toGradePoint(Number(grade.grade)));
      byStudent.set(grade.student_id, list);
    });
    const passingStudents = Array.from(byStudent.values()).filter((list) => isPassing(list.reduce((sum, value) => sum + value, 0) / list.length)).length;
    return {
      quarter: `Q${q}`,
      average: qGrades.length > 0
        ? Math.round(qGrades.reduce((sum, g) => sum + toGradePoint(Number(g.grade)), 0) / qGrades.length * 100) / 100
        : 0,
      passing: passingStudents,
      total: byStudent.size,
    };
  });

  // Year Level Performance
  const yearLevelData = ['1st', '2nd', '3rd', '4th'].map(year => {
    const yearSubjects = subjects.filter(s => s.year_level === year);
    const yearGrades = filteredGrades.filter(g => yearSubjects.find(s => s.id === g.subject_id));
    const points = collectSubjectFinalGradePoints(yearGrades);
    return {
      year: `${year} Year`,
      average: points.length > 0 ? calculateGwaFromSubjectFinals(yearGrades) : 0,
      count: yearGrades.length,
    };
  });

  // Course Comparison
  const courseComparison = courses.map(course => {
    const courseSubjects = subjects.filter(s => s.course_id === course.id);
    const courseGrades = filteredGrades.filter(g => courseSubjects.find(s => s.id === g.subject_id));
    return {
      name: course.name.substring(0, 12),
      average: courseGrades.length > 0 ? calculateGwaFromSubjectFinals(courseGrades) : 0,
    };
  }).filter((row) => row.average > 0);

  // Top Performers
  const topPerformers = filteredStudents.map(student => {
    const studentGrades = filteredGrades.filter(g => g.student_id === student.id);
    const subjectCount = new Set(studentGrades.map((g) => g.subject_id)).size;
    return {
      name: formatPersonDisplayName(student).substring(0, 15),
      gwa: calculateGwaFromSubjectFinals(studentGrades),
      subjectCount,
      grades: studentGrades.length,
    };
  }).filter(s => s.grades > 0 && s.gwa > 0).sort((a, b) => compareNumeric(a.gwa, b.gwa)).slice(0, 5);

  const deanListByCourse = courses.map((course) => {
    const courseStudents = filteredStudents.filter((student) => student.course_id === course.id);
    const deanListStudents = courseStudents.map((student) => {
      const studentGrades = filteredGrades.filter((grade) => grade.student_id === student.id);
      const finals = collectSubjectFinalGradePoints(studentGrades);
      if (finals.length === 0 || finals.some((gp) => gp > 2.25)) return null;
      return {
        id: student.id,
        name: formatPersonDisplayName(student) || 'Unknown Student',
        gwa: calculateGwaFromSubjectFinals(studentGrades),
        gradeCount: studentGrades.length,
      };
    }).filter(Boolean).sort((a, b) => compareNumeric(a?.gwa || 0, b?.gwa || 0)) as Array<{
      id: string;
      name: string;
      gwa: number;
      gradeCount: number;
    }>;
    return {
      courseId: course.id,
      courseName: course.name || 'Course',
      deanListStudents,
    };
  }).filter((row) => row.deanListStudents.length > 0);

  // Grade Heatmap Data (by quarter and subject)
  const quarterSubjectData = [1, 2, 3, 4].map((q) => {
    const qGrades = filteredGrades.filter((g) => g.quarter === q && g.grade_status !== 'inc');
    return {
      quarter: `Q${q}`,
      excellent: qGrades.filter((g) => toGradePoint(Number(g.grade)) <= 1.5).length,
      satisfactory: qGrades.filter((g) => {
        const gp = toGradePoint(Number(g.grade));
        return gp > 1.5 && gp <= 2.5;
      }).length,
      fair: qGrades.filter((g) => toGradePoint(Number(g.grade)) === 2.75).length,
      passing: qGrades.filter((g) => toGradePoint(Number(g.grade)) === 3.0).length,
      failed: qGrades.filter((g) => toGradePoint(Number(g.grade)) >= 5.0).length,
    };
  });

  const subjectPassFailData = buildSubjectPassFailData(subjects, filteredGrades).slice(0, 20);

  const overallAverage = calculateGwaFromSubjectFinals(filteredGrades);
  const passRate = studentPassRows.length > 0 ? Math.round((passingCount / studentPassRows.length) * 100) : 0;

  const hasActiveCourseFilter = selectedCourse !== 'all';
  const clearFilters = () => {
    setSelectedCourse('all');
    setAnimated(false);
    setTimeout(() => setAnimated(true), 100);
  };

  return (
    <DashboardLayout title="Analytics & Reports">
      <PageIntro
        title="System-wide analytics" 
      />
      {activeSchoolYearName && (
        <p className="mb-3 text-sm text-gray-600">
          Active School Year: <span className="font-semibold text-[#800000]">{activeSchoolYearName}</span>
        </p>
      )}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-maroon-200 bg-white text-[#800000] shadow-sm transition-colors hover:bg-maroon-50 touch-manipulation"
          aria-expanded={filtersOpen}
          aria-label={filtersOpen ? 'Hide analytics filters' : 'Show analytics filters'}
          title="Filters"
        >
          <ListFilter className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          {hasActiveCourseFilter && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#d4af37] ring-2 ring-white" aria-hidden />
          )}
        </button>
        {!filtersOpen && (
          <span className="text-xs text-gray-500 sm:text-sm">
            Total Records: {filteredGrades.length} grades • {filteredStudents.length} students
          </span>
        )}
      </div>

      {filtersOpen && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 animate-fade-in">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-[#800000]">Filter analytics</h2>
            {hasActiveCourseFilter && (
              <Button type="button" variant="secondary" className="w-full shrink-0 sm:w-auto" onClick={clearFilters}>
                <RefreshCw className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                Clear filters
              </Button>
            )}
          </div>
          <Select
            label="Filter by Course"
            value={selectedCourse}
            onChange={(e) => {
              setSelectedCourse(e.target.value);
              setAnimated(false);
              setTimeout(() => setAnimated(true), 100);
            }}
            options={sortSelectOptions(
              [{ value: 'all', label: 'All Courses' }, ...sortByName(courses).map((c) => ({ value: c.id, label: c.name || '' }))],
              ['all']
            )}
            className="w-full sm:max-w-xs"
          />
          <p className="mt-4 text-xs text-gray-500 sm:text-sm">
            Total Records: {filteredGrades.length} grades • {filteredStudents.length} students
          </p>
        </div>
      )}

      {/* Animated Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {[
          { label: 'Total Students', value: filteredStudents.length, Icon: Users, color: '#800000' },
          { label: 'Total Subjects', value: subjects.length, Icon: BookOpen, color: '#d4af37' },
          { label: 'Pass Rate (All Subjects Passed)', value: `${passRate}%`, Icon: CheckCircle2, color: '#4CAF50' },
          { label: 'Average GWA', value: formatGwa(overallAverage), Icon: ChartLine, color: '#2196F3' },
        ].map((stat, i) => (
          <GlassCard key={i} className={`p-3 sm:p-4 text-center animate-delay-${i * 100} animate-in fade-in slide-in-from-bottom duration-500 opacity-100`}>
            <div className="text-3xl mb-2">
              <stat.Icon size={28} style={{ color: stat.color }} />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-[#800000]">{stat.value}</p>
            <p className="text-xs sm:text-sm text-gray-600 leading-snug">{stat.label}</p>
          </GlassCard>
        ))}
      </div>

      {/* Row 1: Pie Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8">
        <GlassCard className="p-4 sm:p-6 animate-delay-200 animate-in fade-in slide-in-from-left duration-500">
          <h3 className="text-lg font-semibold text-[#800000] mb-4 flex items-center gap-2">
            <BarChart3 size={20} />
            Grade Distribution
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" labelLine={false} label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`} outerRadius={100} fill="#8884d8" dataKey="value" animationDuration={1500} animationBegin={300}>
                {pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} stroke="white" strokeWidth={2} />))}
              </Pie>
              <Tooltip formatter={(value) => [value, 'Students']} {...chartTooltip} />
              <Legend {...chartLegend} />
            </PieChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6 animate-delay-300 animate-in fade-in slide-in-from-right duration-500">
          <h3 className="text-lg font-semibold text-[#800000] mb-4 flex items-center gap-2">
            <GraduationCap size={20} />
            Pass/Fail Rate
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={passFailData} cx="50%" cy="50%" labelLine={false} label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`} innerRadius={60} outerRadius={100} fill="#8884d8" dataKey="value" animationDuration={1500} animationBegin={400}>
                {passFailData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} stroke="white" strokeWidth={2} />))}
              </Pie>
              <Tooltip formatter={(value) => [value, 'Students']} {...chartTooltip} />
              <Legend {...chartLegend} />
            </PieChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      {/* Row 2: Bar & Line Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8">
        <GlassCard className={`p-4 sm:p-6 ${animated ? 'animate-in fade-in slide-in-from-left duration-500' : 'opacity-0'}`} style={{ animationDelay: '400ms' }}>
          <h3 className="text-lg font-semibold text-[#800000] mb-4 flex items-center gap-2">
            <BarChart3 size={20} />
            Subject Performance
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={subjectPerformance} layout="vertical">
              <CartesianGrid {...chartGrid} />
              <XAxis type="number" domain={[1, 5]} reversed {...chartAxis} />
              <YAxis type="category" dataKey="name" width={100} {...chartAxis} />
              <Tooltip formatter={(value) => [value, 'Average']} {...chartTooltip} />
              <Bar dataKey="average" fill="#800000" radius={[0, 4, 4, 0]} animationDuration={1500} animationBegin={500} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className={`p-4 sm:p-6 ${animated ? 'animate-in fade-in slide-in-from-right duration-500' : 'opacity-0'}`} style={{ animationDelay: '500ms' }}>
          <h3 className="text-lg font-semibold text-[#800000] mb-4 flex items-center gap-2">
            <TrendingUp size={20} />
            Quarterly Trend
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={quarterlyData}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="quarter" {...chartAxis} />
              <YAxis domain={[1, 5]} reversed {...chartAxis} />
              <Tooltip {...chartTooltip} />
              <Area type="monotone" dataKey="average" stroke="#d4af37" fill="url(#gradient)" strokeWidth={2} animationDuration={1500} animationBegin={600} name="Avg GWA" />
              <Area type="monotone" dataKey="passing" stroke="#4CAF50" fill="transparent" strokeWidth={2} />
              <Legend {...chartLegend} />
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8">
        <GlassCard className={`p-4 sm:p-6 ${animated ? 'animate-in fade-in slide-in-from-bottom duration-500' : 'opacity-0'}`} style={{ animationDelay: '600ms' }}>
          <h3 className="text-lg font-semibold text-[#800000] mb-4 flex items-center gap-2">
            <GraduationCap size={20} />
            Year Level Performance
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={yearLevelData}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="year" {...chartAxis} />
              <YAxis domain={[1, 5]} reversed {...chartAxis} />
              <Tooltip {...chartTooltip} />
              <Bar dataKey="average" fill="#800000" radius={[4, 4, 0, 0]} animationDuration={1500} name="Avg GWA" />
            </ComposedChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className={`p-4 sm:p-6 ${animated ? 'animate-in fade-in slide-in-from-bottom duration-500' : 'opacity-0'}`} style={{ animationDelay: '700ms' }}>
          <h3 className="text-lg font-semibold text-[#800000] mb-4 flex items-center gap-2">
            <BookOpen size={20} />
            Course Comparison
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={courseComparison}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="name" {...chartAxis} />
              <YAxis domain={[1, 5]} reversed {...chartAxis} />
              <Tooltip {...chartTooltip} />
              <Bar dataKey="average" fill="#d4af37" radius={[4, 4, 0, 0]} animationDuration={1500} name="Avg GWA" />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className={`p-4 sm:p-6 ${animated ? 'animate-in fade-in slide-in-from-bottom duration-500' : 'opacity-0'}`} style={{ animationDelay: '800ms' }}>
          <h3 className="text-lg font-semibold text-[#800000] mb-4 flex items-center gap-2">
            <ChartLine size={20} />
            Grade by Quarter
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={quarterSubjectData}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="quarter" {...chartAxis} />
              <YAxis {...chartAxis} />
              <Tooltip {...chartTooltip} />
              <Legend {...chartLegend} />
              <Bar dataKey="excellent" stackId="a" fill="#800000" name="Excellent / Very Good" />
              <Bar dataKey="satisfactory" stackId="a" fill="#4CAF50" name="Satisfactory" />
              <Bar dataKey="fair" stackId="a" fill="#2196F3" name="Fair" />
              <Bar dataKey="passing" stackId="a" fill="#9C27B0" name="Passing" />
              <Bar dataKey="failed" stackId="a" fill="#f44336" name="Failed" />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      <GlassCard className={`mb-8 p-4 sm:p-6 ${animated ? 'animate-in fade-in duration-500' : 'opacity-0'}`} style={{ animationDelay: '850ms' }}>
        <h3 className="text-lg font-semibold text-[#800000] mb-4 flex items-center gap-2">
          <CheckCircle2 size={20} />
          Pass/Fail by Subject (All Subjects)
        </h3>
        {subjectPassFailData.length === 0 ? (
          <p className="text-gray-500">No subject pass/fail data available yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={subjectPassFailData}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="name" {...chartAxis} />
              <YAxis allowDecimals={false} {...chartAxis} />
              <Tooltip {...chartTooltip} />
              <Legend {...chartLegend} />
              <Bar dataKey="Passing" stackId="a" fill="#4CAF50" />
              <Bar dataKey="Failing" stackId="a" fill="#f44336" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </GlassCard>

      {/* Top Performers */}
      {topPerformers.length > 0 && (
        <GlassCard className={`p-4 sm:p-6 ${animated ? 'animate-in fade-in duration-500' : 'opacity-0'}`} style={{ animationDelay: '900ms' }}>
          <h3 className="text-lg font-semibold text-[#800000] mb-4 flex items-center gap-2">
            <Trophy size={20} />
            Top Performers
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {topPerformers.map((student, i) => (
              <div key={i} className="text-center p-4 rounded-xl bg-gradient-to-br from-[#800000]/10 to-[#d4af37]/10 border border-[#800000]/20">
                {i === 0 ? <GraduationCap className="h-8 w-8 mx-auto text-yellow-500" /> : i === 1 ? <TrendingUp className="h-7 w-7 mx-auto text-yellow-400" /> : i === 2 ? <BarChart3 className="h-6 w-6 mx-auto text-yellow-300" /> : <Users className="h-6 w-6 mx-auto text-yellow-400" />}
                <p className="font-semibold text-gray-800 text-sm">{student.name}</p>
                <p className="text-xl font-bold text-[#800000]">{formatGwa(student.gwa)}</p>
                <p className="text-xs text-gray-500">{student.subjectCount} subject{student.subjectCount !== 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <GlassCard className={`mt-8 p-4 sm:p-6 ${animated ? 'animate-in fade-in duration-500' : 'opacity-0'}`} style={{ animationDelay: '950ms' }}>
        <h3 className="text-lg font-semibold text-[#800000] mb-4 flex items-center gap-2">
          <Trophy size={20} />
          Dean&apos;s List by Course
        </h3>
        
        {deanListByCourse.length === 0 ? (
          <p className="text-gray-500">No Dean&apos;s List students match the current filters yet.</p>
        ) : (
          <div className="space-y-4">
            {deanListByCourse.map((courseRow) => (
              <div key={courseRow.courseId} className="rounded-xl border border-maroon-200/60 bg-white p-4">
                <p className="font-semibold text-[#800000]">{courseRow.courseName}</p>
                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {courseRow.deanListStudents.map((studentRow) => (
                    <div key={studentRow.id} className="rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/10 p-3">
                      <p className="font-semibold text-gray-800">{studentRow.name}</p>
                      <p className="text-sm text-gray-700">GWA: {formatGwa(studentRow.gwa)}</p>
                      <p className="text-xs text-gray-500">Based on {studentRow.gradeCount} recorded grade{studentRow.gradeCount !== 1 ? 's' : ''}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </DashboardLayout>
  );
}

