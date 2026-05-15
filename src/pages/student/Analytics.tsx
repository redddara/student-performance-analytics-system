import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSupabaseLiveReload } from '../../lib/useSupabaseLiveReload';
import { AlertTriangle, Lightbulb, Star } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, PageSkeletonLoader, Select } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, isPassing, calculateGWA } from '../../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { chartAxis, chartGrid, chartTooltip } from '../../lib/chartTheme';
import { compareAlphabetical } from '../../lib/sortUtils';

type GradeRow = {
  subject_id?: string;
  quarter?: number;
  school_year_id?: string | null;
  subject?: { name?: string };
  school_year?: { id?: string; name?: string };
  grade_status?: string;
  grade?: number;
};

type AnalyticsBucket = { subject_id: string; school_year_id: string | null; displayName: string };

export default function StudentAnalyticsPage() {
  const { user } = useAuthStore();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [myGrades, setMyGrades] = useState<GradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [strengths, setStrengths] = useState<string[]>([]);
  const [weaknesses, setWeaknesses] = useState<string[]>([]);
  const [activeSchoolYearId, setActiveSchoolYearId] = useState<string | null>(null);
  const [activeSchoolYearName, setActiveSchoolYearName] = useState<string>('');
  /** '' = all school years */
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState('');

  const loadData = useCallback(async () => {
    try {
      const { data: studentData } = await supabase
        .from('students')
        .select('*, course:courses(*)')
        .eq('user_id', user?.id)
        .single();

      if (!studentData) return;

      const [subjectsRes, activeSyRes, gradesRes] = await Promise.all([
        supabase.from('student_subjects').select('*, subject:subjects(*, course:courses(*))').eq('student_id', studentData.id),
        supabase.from('school_years').select('id,name').eq('is_active', true).maybeSingle(),
        supabase
          .from('grades')
          .select('*, subject:subjects(*, course:courses(*)), school_year:school_years(id,name)')
          .eq('student_id', studentData.id),
      ]);

      const activeSy = activeSyRes.data as { id?: string; name?: string } | null;
      if (activeSyRes.error) {
        setActiveSchoolYearId(null);
        setActiveSchoolYearName('');
        setSelectedSchoolYearId('');
      } else {
        setActiveSchoolYearId(activeSy?.id ?? null);
        setActiveSchoolYearName(activeSy?.name || '');
        if (activeSy?.id) setSelectedSchoolYearId(activeSy.id);
        else setSelectedSchoolYearId('');
      }

      const grades = (gradesRes.data as GradeRow[]) || [];
      setMySubjects(subjectsRes.data || []);
      setMyGrades(grades);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useSupabaseLiveReload(loadData, user?.id ? `live:student-analytics:${user.id}` : null, [
    'grades',
    'student_subjects',
    'school_years',
    'subjects',
    'students',
  ]);

  const schoolYearOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const g of myGrades) {
      const id = g.school_year_id;
      if (!id) continue;
      const name = g.school_year?.name || 'School year';
      byId.set(id, name);
    }
    if (activeSchoolYearId && activeSchoolYearName) {
      if (!byId.has(activeSchoolYearId)) {
        byId.set(activeSchoolYearId, activeSchoolYearName);
      }
    }
    const rows = [...byId.entries()].sort((a, b) => compareAlphabetical(a[1], b[1]));
    return [{ value: '', label: 'All school years' }, ...rows.map(([value, label]) => ({ value, label }))];
  }, [myGrades, activeSchoolYearId, activeSchoolYearName]);

  const filteredGrades = useMemo(() => {
    if (!selectedSchoolYearId) return myGrades;
    return myGrades.filter((g) => g.school_year_id === selectedSchoolYearId);
  }, [myGrades, selectedSchoolYearId]);

  const analyticsBuckets = useMemo(() => {
    const buckets: AnalyticsBucket[] = [];
    const seen = new Set<string>();
    for (const g of filteredGrades) {
      if (!g.subject_id) continue;
      const sy = g.school_year_id ?? null;
      const k = `${g.subject_id}:${sy ?? 'null'}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const yearPart = g.school_year?.name ? ` (${g.school_year.name})` : '';
      buckets.push({
        subject_id: g.subject_id,
        school_year_id: sy,
        displayName: `${g.subject?.name || 'Subject'}${yearPart}`,
      });
    }
    return buckets;
  }, [filteredGrades]);

  const analyzePerformanceFromGrades = useCallback((grades: GradeRow[], buckets: AnalyticsBucket[]) => {
    const newSuggestions: string[] = [];
    const newStrengths: string[] = [];
    const newWeaknesses: string[] = [];

    const bucketKey = (subjectId: string, schoolYearId: string | null) =>
      `${subjectId}:${schoolYearId ?? 'null'}`;

    const subjectAverages: Record<string, number> = {};
    buckets.forEach((b) => {
      const k = bucketKey(b.subject_id, b.school_year_id);
      const subjectGrades = grades.filter(
        (g) => g.subject_id === b.subject_id && (g.school_year_id ?? null) === (b.school_year_id ?? null)
      );
      if (subjectGrades.length > 0) {
        subjectAverages[k] = calculateGWA(subjectGrades as any[]);
      }
    });

    Object.entries(subjectAverages).forEach(([key, avg]) => {
      const b = buckets.find((x) => bucketKey(x.subject_id, x.school_year_id) === key);
      if (!b) return;
      if (avg >= 85) {
        newStrengths.push(`${b.displayName}: ${avg.toFixed(2)}`);
      } else if (avg < 75) {
        newWeaknesses.push(`${b.displayName}: ${avg.toFixed(2)}`);
      }
    });

    Object.entries(subjectAverages)
      .filter(([, avg]) => avg < 75)
      .forEach(([key, avg]) => {
        const b = buckets.find((x) => bucketKey(x.subject_id, x.school_year_id) === key);
        if (b) {
          newSuggestions.push(`Focus on ${b.displayName} — currently at ${avg.toFixed(2)}, below passing`);
        }
      });

    buckets.forEach((b) => {
      const k = bucketKey(b.subject_id, b.school_year_id);
      const subjectGrades = grades.filter(
        (g) => g.subject_id === b.subject_id && (g.school_year_id ?? null) === (b.school_year_id ?? null)
      );
      const hasFinals = subjectGrades.some((g) => g.quarter === 4);
      if (subjectGrades.length > 0 && !hasFinals) {
        const currentAvg = subjectAverages[k];
        if (currentAvg !== undefined) {
          const neededForPass = Math.max(0, 75 - (currentAvg * 0.4) / 0.6);
          if (neededForPass <= 100) {
            newSuggestions.push(`Score at least ${neededForPass.toFixed(0)} in Finals to pass ${b.displayName}`);
          }
        }
      }
    });

    const overallGWA = grades.length > 0 ? calculateGWA(grades as any[]) : 0;
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
  }, []);

  useEffect(() => {
    analyzePerformanceFromGrades(filteredGrades, analyticsBuckets);
  }, [filteredGrades, analyticsBuckets, analyzePerformanceFromGrades]);

  const subjectPerformance = useMemo(() => {
    return analyticsBuckets
      .map((b) => {
        const subjectGrades = filteredGrades.filter(
          (g) => g.subject_id === b.subject_id && (g.school_year_id ?? null) === (b.school_year_id ?? null)
        );
        const avg = subjectGrades.length > 0 ? calculateGWA(subjectGrades as any[]) : 0;
        return {
          name: b.displayName.substring(0, 18),
          average: avg,
        };
      })
      .filter((s) => s.average > 0);
  }, [analyticsBuckets, filteredGrades]);

  const quarterlyData = useMemo(() => {
    return [1, 2, 3, 4].map((q) => {
      const qGrades = filteredGrades.filter((g) => g.quarter === q);
      return {
        quarter: `Q${q}`,
        average: qGrades.length > 0 ? calculateGWA(qGrades as any[]) : 0,
      };
    });
  }, [filteredGrades]);

  const overallGWA = useMemo(
    () => (filteredGrades.length > 0 ? calculateGWA(filteredGrades as any[]) : 0),
    [filteredGrades]
  );

  const passRate = useMemo(() => {
    const subjectAverages = analyticsBuckets.map((b) => {
      const subjectGrades = filteredGrades.filter(
        (g) => g.subject_id === b.subject_id && (g.school_year_id ?? null) === (b.school_year_id ?? null)
      );
      return {
        average: subjectGrades.length > 0 ? calculateGWA(subjectGrades as any[]) : 0,
        hasGrades: subjectGrades.length > 0,
      };
    });
    const withGrades = subjectAverages.filter((row) => row.hasGrades);
    const passingSubjects = withGrades.filter((row) => isPassing(row.average)).length;
    return withGrades.length > 0 ? Math.round((passingSubjects / withGrades.length) * 100) : 0;
  }, [analyticsBuckets, filteredGrades]);

  const analyticsScopeLabel =
    selectedSchoolYearId === ''
      ? 'All school years'
      : schoolYearOptions.find((o) => o.value === selectedSchoolYearId)?.label || activeSchoolYearName;

  if (loading) {
    return <DashboardLayout title="Analytics"><PageSkeletonLoader rows={5} /></DashboardLayout>;
  }

  return (
    <DashboardLayout title="My Analytics">
      <div className="mb-5 w-full max-w-md">
        <Select
          label="School year"
          value={selectedSchoolYearId}
          onChange={(e) => setSelectedSchoolYearId(e.target.value)}
          options={schoolYearOptions}
        />
      </div>

      <p className="mb-3 text-sm text-gray-600">
        Showing analytics for{' '}
        <span className="font-semibold text-[#800000]">{analyticsScopeLabel}</span>
        {activeSchoolYearName ? (
          <>
            {' '}
            (active school year: <span className="font-semibold text-[#800000]">{activeSchoolYearName}</span>)
          </>
        ) : null}
      </p>
    
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
        <GlassCard className="p-4 sm:p-6 text-center">
          <p className="text-3xl sm:text-4xl font-bold text-[#800000]">{overallGWA.toFixed(2)}</p>
          <p className="text-sm sm:text-base text-gray-500">Overall GWA</p>
        </GlassCard>
        <GlassCard className="p-4 sm:p-6 text-center">
          <p className="text-3xl sm:text-4xl font-bold text-gold-600">{passRate}%</p>
          <p className="text-sm sm:text-base text-gray-500">Pass Rate (Subject GWA)</p>
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
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gold-600">
            <Star className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            Strengths
          </h3>
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
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-red-600">
            <AlertTriangle className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            Areas to Improve
          </h3>
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
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#800000]">
            <Lightbulb className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            Suggestions
          </h3>
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