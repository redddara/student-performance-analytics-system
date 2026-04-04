import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Spinner } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, isPassing, calculateGWA } from '../../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { chartAxis, chartGrid, chartTooltip } from '../../lib/chartTheme';

export default function StudentAnalyticsPage() {
  const { user } = useAuthStore();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [myGrades, setMyGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [strengths, setStrengths] = useState<string[]>([]);
  const [weaknesses, setWeaknesses] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: studentData } = await supabase
        .from('students')
        .select('*, course:courses(*)')
        .eq('user_id', user?.id)
        .single();

      if (!studentData) return;

      const [subjectsRes, gradesRes] = await Promise.all([
        supabase.from('student_subjects').select('*, subject:subjects(*, course:courses(*))').eq('student_id', studentData.id),
        supabase.from('grades').select('*').eq('student_id', studentData.id),
      ]);

      setMySubjects(subjectsRes.data || []);
      setMyGrades(gradesRes.data || []);

      // Analyze performance
      analyzePerformance(subjectsRes.data || [], gradesRes.data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzePerformance = (subjects: any[], grades: any[]) => {
    const newSuggestions: string[] = [];
    const newStrengths: string[] = [];
    const newWeaknesses: string[] = [];

    // Calculate subject averages
    const subjectAverages: { [key: string]: number } = {};
    subjects.forEach(ss => {
      const subjectGrades = grades.filter(g => g.subject_id === ss.subject_id);
      if (subjectGrades.length > 0) {
        subjectAverages[ss.subject_id] = calculateGWA(subjectGrades);
      }
    });

    // Find strengths (avg >= 85)
    Object.entries(subjectAverages).forEach(([subjectId, avg]) => {
      const subject = subjects.find(s => s.subject_id === subjectId);
      if (avg >= 85) {
        newStrengths.push(`${subject?.subject?.name}: ${avg.toFixed(2)}`);
      } else if (avg < 75) {
        newWeaknesses.push(`${subject?.subject?.name}: ${avg.toFixed(2)}`);
      }
    });

    // Check for incomplete quarters
    const failingSubjects = Object.entries(subjectAverages).filter(([_, avg]) => avg < 75);
    failingSubjects.forEach(([subjectId, avg]) => {
      const subject = subjects.find(s => s.subject_id === subjectId);
      newSuggestions.push(`Focus on ${subject?.subject?.name} — currently at ${avg.toFixed(2)}, below passing`);
    });

    // Check for missing grades
    subjects.forEach(ss => {
      const subjectGrades = grades.filter(g => g.subject_id === ss.subject_id);
      const hasFinals = subjectGrades.some(g => g.quarter === 4);
      
      if (subjectGrades.length > 0 && !hasFinals) {
        const currentAvg = subjectAverages[ss.subject_id];
        const neededForPass = Math.max(0, 75 - (currentAvg * 0.4) / 0.6);
        if (neededForPass <= 100) {
          newSuggestions.push(`Score at least ${neededForPass.toFixed(0)} in Finals to pass ${ss.subject?.name}`);
        }
      }
    });

    // Overall GWA suggestion
    const overallGWA = grades.length > 0 ? calculateGWA(grades) : 0;
    if (overallGWA >= 85) {
      newSuggestions.push('Great job! Maintain your excellent performance');
    } else if (overallGWA >= 75) {
      newSuggestions.push('Keep working to improve your GWA above 85');
    } else {
      newSuggestions.push('Focus on improving your grades across all subjects');
    }

    setSuggestions(newSuggestions);
    setStrengths(newStrengths);
    setWeaknesses(newWeaknesses);
  };

  if (loading) {
    return <DashboardLayout title="Analytics"><Spinner size="lg" /></DashboardLayout>;
  }

  // Prepare chart data
  const subjectPerformance = mySubjects.map(ss => {
    const subjectGrades = myGrades.filter(g => g.subject_id === ss.subject_id);
    const avg = subjectGrades.length > 0 ? calculateGWA(subjectGrades) : 0;
    return {
      name: ss.subject?.name?.substring(0, 12) || 'Subject',
      average: avg,
    };
  }).filter(s => s.average > 0);

  // Quarterly trends
  const quarterlyData = [1, 2, 3, 4].map(q => {
    const qGrades = myGrades.filter(g => g.quarter === q);
    return {
      quarter: `Q${q}`,
      average: qGrades.length > 0 ? calculateGWA(qGrades) : 0,
    };
  });

  const overallGWA = myGrades.length > 0 ? calculateGWA(myGrades) : 0;
  const passingCount = myGrades.filter(g => isPassing(g.grade)).length;
  const passRate = myGrades.length > 0 ? Math.round((passingCount / myGrades.length) * 100) : 0;

  return (
    <DashboardLayout title="My Analytics">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
        <GlassCard className="p-4 sm:p-6 text-center">
          <p className="text-3xl sm:text-4xl font-bold text-[#800000]">{overallGWA.toFixed(2)}</p>
          <p className="text-sm sm:text-base text-gray-500">Overall GWA</p>
        </GlassCard>
        <GlassCard className="p-4 sm:p-6 text-center">
          <p className="text-3xl sm:text-4xl font-bold text-gold-600">{passRate}%</p>
          <p className="text-sm sm:text-base text-gray-500">Pass Rate</p>
        </GlassCard>
        <GlassCard className="p-4 sm:p-6 text-center">
          <p className="text-3xl sm:text-4xl font-bold text-[#d4af37]">{mySubjects.length}</p>
          <p className="text-sm sm:text-base text-gray-500">Enrolled Subjects</p>
        </GlassCard>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8">
        <GlassCard className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-[#800000] mb-4">Performance by Subject</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={subjectPerformance}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="name" fontSize={10} {...chartAxis} />
              <YAxis domain={[0, 100]} {...chartAxis} />
              <Tooltip {...chartTooltip} />
              <Bar dataKey="average" fill="#800000" name="Average" />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-[#800000] mb-4">Quarterly Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={quarterlyData}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="quarter" {...chartAxis} />
              <YAxis domain={[0, 100]} {...chartAxis} />
              <Tooltip {...chartTooltip} />
              <Line type="monotone" dataKey="average" stroke="#d4af37" strokeWidth={2} name="Average" />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      {/* Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Strengths */}
        <GlassCard className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gold-600 mb-4"><i className="hgi-stroke hgi-star text-xl mr-2"/>Strengths</h3>
          {strengths.length === 0 ? (
            <p className="text-gray-500">No strong subjects yet</p>
          ) : (
            <ul className="space-y-2">
              {strengths.map((s, i) => (
                <li key={i} className="p-2 rounded-lg bg-green-50 text-green-700 text-sm">{s}</li>
              ))}
            </ul>
          )}
        </GlassCard>

        {/* Weaknesses */}
        <GlassCard className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-red-600 mb-4"><i className="hgi-stroke hgi-warning-02 text-xl"></i> Areas to Improve</h3>
          {weaknesses.length === 0 ? (
            <p className="text-gray-500">No weak subjects — great job!</p>
          ) : (
            <ul className="space-y-2">
              {weaknesses.map((w, i) => (
                <li key={i} className="p-2 rounded-lg bg-red-50 text-red-700 text-sm">{w}</li>
              ))}
            </ul>
          )}
        </GlassCard>

        {/* Suggestions */}
        <GlassCard className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-[#800000] mb-4">💡 Suggestions</h3>
          {suggestions.length === 0 ? (
            <p className="text-gray-500">Keep studying!</p>
          ) : (
            <ul className="space-y-2">
              {suggestions.map((s, i) => (
                <li key={i} className="p-2 rounded-lg bg-[#800000]/10 text-[#800000] text-sm">{s}</li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}