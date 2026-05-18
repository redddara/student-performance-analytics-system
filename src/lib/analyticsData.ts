import { supabase } from './supabase';
import {
  calculateOfficialGwa,
  computeSubjectFinalAverage,
  getRemarkCategory,
  type RemarkCategory,
} from './gradingScale';

export type AnalyticsGradeRow = {
  student_id?: string;
  subject_id?: string;
  semester?: number;
  school_year_id?: string | null;
  grade?: number | null;
  grade_status?: string | null;
  quarter?: number;
};

export function subjectSemesterBucketKey(g: AnalyticsGradeRow): string {
  return `${g.student_id ?? ''}:${g.subject_id ?? ''}:${g.semester ?? 0}`;
}

export function groupGradesBySubjectSemester(
  grades: AnalyticsGradeRow[]
): Map<string, AnalyticsGradeRow[]> {
  const map = new Map<string, AnalyticsGradeRow[]>();
  for (const g of grades) {
    if (!g.student_id || !g.subject_id) continue;
    const key = subjectSemesterBucketKey(g);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(g);
  }
  return map;
}

/** Collect official final grade point per subject-semester (from percent average → scale). */
export function collectSubjectFinalGradePoints(grades: AnalyticsGradeRow[]): number[] {
  const buckets = groupGradesBySubjectSemester(grades);
  const points: number[] = [];
  for (const bucket of buckets.values()) {
    const summary = computeSubjectFinalAverage(bucket);
    if (summary.status === 'inc' || summary.gradePoint == null) continue;
    points.push(summary.gradePoint);
  }
  return points;
}

/** GWA from subject finals only; always an official grade point (1–3, 5 scale). */
export function calculateGwaFromSubjectFinals(grades: AnalyticsGradeRow[]): number {
  return calculateOfficialGwa(collectSubjectFinalGradePoints(grades));
}

/** Mean official final for one subject across students (for subject performance charts). */
export function averageSubjectFinalGradePoint(subjectGrades: AnalyticsGradeRow[]): number {
  const byStudent = new Map<string, AnalyticsGradeRow[]>();
  for (const g of subjectGrades) {
    if (!g.student_id) continue;
    const list = byStudent.get(g.student_id) || [];
    list.push(g);
    byStudent.set(g.student_id, list);
  }
  const points: number[] = [];
  for (const bucket of byStudent.values()) {
    const summary = computeSubjectFinalAverage(bucket);
    if (summary.gradePoint != null) points.push(summary.gradePoint);
  }
  return calculateOfficialGwa(points);
}

/**
 * Student passes only when every subject-semester with grades has official status "passed".
 * Matches admin Grades / class record — a single failed subject means the student failed.
 */
export function isStudentPassingBySubjectFinals(grades: AnalyticsGradeRow[]): boolean {
  const buckets = groupGradesBySubjectSemester(grades);
  if (buckets.size === 0) return false;
  for (const bucket of buckets.values()) {
    const summary = computeSubjectFinalAverage(bucket);
    if (summary.status !== 'passed') return false;
  }
  return true;
}

export type ActiveSchoolYear = { id: string; name: string } | null;

/** Active school year from Supabase; null if none or table unavailable. */
export async function fetchActiveSchoolYear(): Promise<ActiveSchoolYear> {
  try {
    const res = await supabase
      .from('school_years')
      .select('id,name')
      .eq('is_active', true)
      .maybeSingle();
    if (res.error) throw res.error;
    const row = res.data as { id?: string; name?: string } | null;
    if (!row?.id) return null;
    return { id: row.id, name: row.name || '' };
  } catch {
    return null;
  }
}

export function filterGradesBySchoolYear<T extends { school_year_id?: string | null }>(
  grades: T[],
  activeSchoolYearId: string | null
): T[] {
  if (!activeSchoolYearId) return grades;
  return grades.filter((g) => g.school_year_id === activeSchoolYearId);
}

export interface StudentGwaPassRate {
  passRate: number;
  passingCount: number;
  totalWithGrades: number;
}

/** Pass rate by official subject finals (all subjects must pass). */
export function computeStudentGwaPassRate(
  studentIds: string[],
  grades: AnalyticsGradeRow[]
): StudentGwaPassRate {
  const rows = studentIds
    .map((studentId) => {
      const studentGrades = grades.filter((g) => g.student_id === studentId);
      const buckets = groupGradesBySubjectSemester(studentGrades);
      return {
        count: buckets.size,
        passing: isStudentPassingBySubjectFinals(studentGrades),
      };
    })
    .filter((row) => row.count > 0);

  const passingCount = rows.filter((row) => row.passing).length;
  const totalWithGrades = rows.length;
  const passRate =
    totalWithGrades > 0 ? Math.round((passingCount / totalWithGrades) * 100) : 0;

  return { passRate, passingCount, totalWithGrades };
}

export interface RemarkBucketRow {
  name: string;
  value: number;
  color: string;
}

const REMARK_COLORS: Record<RemarkCategory, string> = {
  EXCELLENT: '#800000',
  'VERY GOOD': '#d4af37',
  SATISFACTORY: '#4CAF50',
  FAIR: '#2196F3',
  'FAILED OR CONDITIONAL': '#f44336',
};

const REMARK_LABELS: Record<RemarkCategory, string> = {
  EXCELLENT: 'Excellent',
  'VERY GOOD': 'Very Good',
  SATISFACTORY: 'Satisfactory',
  FAIR: 'Fair',
  'FAILED OR CONDITIONAL': 'Failed / Conditional',
};

/** Grade distribution pie from student GWAs (official remark categories). */
export function buildStudentGwaRemarkDistribution(
  grades: AnalyticsGradeRow[]
): RemarkBucketRow[] {
  const studentIds = [...new Set(grades.map((g) => g.student_id).filter(Boolean))] as string[];

  const buckets: Record<RemarkCategory, number> = {
    EXCELLENT: 0,
    'VERY GOOD': 0,
    SATISFACTORY: 0,
    FAIR: 0,
    'FAILED OR CONDITIONAL': 0,
  };

  for (const studentId of studentIds) {
    const studentGrades = grades.filter((g) => g.student_id === studentId);
    const gwa = calculateGwaFromSubjectFinals(studentGrades);
    if (gwa === 0 && groupGradesBySubjectSemester(studentGrades).size === 0) continue;
    const cat = getRemarkCategory(gwa);
    buckets[cat] = (buckets[cat] || 0) + 1;
  }

  return (Object.keys(buckets) as RemarkCategory[])
    .filter((cat) => buckets[cat] > 0)
    .map((cat) => ({
      name: REMARK_LABELS[cat],
      value: buckets[cat],
      color: REMARK_COLORS[cat],
    }));
}

export interface SubjectPassFailRow {
  name: string;
  Passing: number;
  Failing: number;
  total: number;
}

export function buildSubjectPassFailData(
  subjects: { id: string; name?: string | null }[],
  grades: AnalyticsGradeRow[]
): SubjectPassFailRow[] {
  return subjects
    .map((sub) => {
      const subjectGrades = grades.filter((g) => g.subject_id === sub.id);
      const byStudent = new Map<string, AnalyticsGradeRow[]>();
      subjectGrades.forEach((grade) => {
        if (!grade.student_id) return;
        const list = byStudent.get(grade.student_id) || [];
        list.push(grade);
        byStudent.set(grade.student_id, list);
      });
      let passing = 0;
      let failing = 0;
      for (const bucket of byStudent.values()) {
        const summary = computeSubjectFinalAverage(bucket);
        if (summary.status === 'passed') passing += 1;
        else failing += 1;
      }
      return {
        name: (sub.name || 'Subject').substring(0, 16),
        Passing: passing,
        Failing: failing,
        total: passing + failing,
      };
    })
    .filter((row) => row.total > 0);
}
