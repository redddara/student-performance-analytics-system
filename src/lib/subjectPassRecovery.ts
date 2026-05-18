import { displayGradePercent } from './gradingScale';
import { GRADING_PERIODS } from './gradingPeriods';
import type { GradeRecord } from './studentGradeInsights';

export const PASSING_PERCENT_THRESHOLD = 75;
export const TOTAL_GRADING_PERIODS = GRADING_PERIODS.length;

export type QuarterGradeRow = {
  grade?: number | null;
  grade_status?: string | null;
  quarter?: number | null;
};

export type SubjectPassRecoveryPlan = {
  /** Mean of posted period percentages (not projected final). */
  currentAveragePercent: number;
  completedPeriodCount: number;
  remainingPeriodCount: number;
  remainingPeriodLabels: string[];
  /** Next period without a grade (chronological). */
  nextPeriodLabel: string | null;
  /**
   * Minimum percent needed in each remaining period (equal target) to reach 75% final average.
   * Null when no periods remain or no grades posted yet.
   */
  requiredPercentPerRemaining: number | null;
  achievable: boolean;
  status: 'recoverable' | 'no_periods_left' | 'insufficient_data';
};

export type SubjectNeedToPassRow = SubjectPassRecoveryPlan & {
  subjectId: string;
  subjectName: string;
};

/** Map quarter → display percent; latest row wins if duplicates exist. */
export function periodPercentsByQuarter(grades: QuarterGradeRow[]): Map<number, number> {
  const byQuarter = new Map<number, number>();
  for (const g of grades) {
    if (g.grade_status === 'inc' || g.grade == null || g.quarter == null) continue;
    if (!GRADING_PERIODS.some((p) => p.value === g.quarter)) continue;
    byQuarter.set(g.quarter, displayGradePercent(Number(g.grade)));
  }
  return byQuarter;
}

/**
 * Given posted period grades, compute what the student still needs to pass (75% final average).
 * Final average = mean of all four institutional periods (Prelims–Finals).
 */
export function computeSubjectPassRecovery(grades: QuarterGradeRow[]): SubjectPassRecoveryPlan | null {
  const byQuarter = periodPercentsByQuarter(grades);
  const completedValues = [...byQuarter.entries()].sort((a, b) => a[0] - b[0]).map(([, p]) => p);

  if (completedValues.length === 0) {
    return {
      currentAveragePercent: 0,
      completedPeriodCount: 0,
      remainingPeriodCount: TOTAL_GRADING_PERIODS,
      remainingPeriodLabels: GRADING_PERIODS.map((p) => p.label),
      nextPeriodLabel: GRADING_PERIODS[0]?.label ?? null,
      requiredPercentPerRemaining: null,
      achievable: true,
      status: 'insufficient_data',
    };
  }

  const sumCompleted = completedValues.reduce((acc, p) => acc + p, 0);
  const currentAveragePercent =
    Math.round((sumCompleted / completedValues.length) * 100) / 100;

  const remainingPeriods = GRADING_PERIODS.filter((p) => !byQuarter.has(p.value));
  const remainingPeriodCount = remainingPeriods.length;
  const remainingPeriodLabels = remainingPeriods.map((p) => p.label);
  const nextPeriodLabel = remainingPeriods[0]?.label ?? null;

  if (currentAveragePercent >= PASSING_PERCENT_THRESHOLD) {
    return null;
  }

  if (remainingPeriodCount === 0) {
    return {
      currentAveragePercent,
      completedPeriodCount: completedValues.length,
      remainingPeriodCount: 0,
      remainingPeriodLabels: [],
      nextPeriodLabel: null,
      requiredPercentPerRemaining: null,
      achievable: false,
      status: 'no_periods_left',
    };
  }

  const requiredRaw =
    (PASSING_PERCENT_THRESHOLD * TOTAL_GRADING_PERIODS - sumCompleted) / remainingPeriodCount;
  const requiredPercentPerRemaining = Math.ceil(requiredRaw);
  const achievable = requiredPercentPerRemaining <= 100;

  return {
    currentAveragePercent,
    completedPeriodCount: completedValues.length,
    remainingPeriodCount,
    remainingPeriodLabels,
    nextPeriodLabel,
    requiredPercentPerRemaining,
    achievable,
    status: 'recoverable',
  };
}

export function formatRequiredScoreMessage(plan: SubjectPassRecoveryPlan): string {
  if (plan.status === 'insufficient_data') {
    return 'No period grades posted yet.';
  }
  if (plan.status === 'no_periods_left') {
    return 'All periods are posted and the average is still below 75%. Meet with your teacher about remediation.';
  }
  if (plan.requiredPercentPerRemaining == null) {
    return '—';
  }
  if (!plan.achievable) {
    return `Would need above 100% in the remaining period${plan.remainingPeriodCount === 1 ? '' : 's'} — focus on remediation and teacher support.`;
  }
  if (plan.remainingPeriodCount === 1 && plan.nextPeriodLabel) {
    return `Score at least ${plan.requiredPercentPerRemaining}% in ${plan.nextPeriodLabel} to pass.`;
  }
  const periodList = plan.remainingPeriodLabels.join(', ');
  return `Score at least ${plan.requiredPercentPerRemaining}% in each remaining period (${periodList}) to pass.`;
}

export type BuildSubjectsNeedToPassOptions = {
  grades: GradeRecord[];
  activeSchoolYearId: string | null;
  currentSemester: number;
  visibleSubjectIds: Set<string>;
  subjectNames: Map<string, string>;
};

export function buildSubjectsNeedToPass(options: BuildSubjectsNeedToPassOptions): SubjectNeedToPassRow[] {
  const { grades, activeSchoolYearId, currentSemester, visibleSubjectIds, subjectNames } = options;

  const scoped = grades.filter((g) => {
    if (!g.subject_id || !visibleSubjectIds.has(g.subject_id)) return false;
    if (g.semester !== currentSemester) return false;
    if (activeSchoolYearId) {
      return g.school_year_id === activeSchoolYearId;
    }
    return g.school_year_id == null;
  });

  const bySubject = new Map<string, GradeRecord[]>();
  for (const g of scoped) {
    if (!g.subject_id) continue;
    if (!bySubject.has(g.subject_id)) bySubject.set(g.subject_id, []);
    bySubject.get(g.subject_id)!.push(g);
  }

  const rows: SubjectNeedToPassRow[] = [];

  for (const [subjectId, bucket] of bySubject) {
    const plan = computeSubjectPassRecovery(bucket);
    if (!plan) continue;
    if (plan.status === 'insufficient_data') continue;
    if (plan.currentAveragePercent >= PASSING_PERCENT_THRESHOLD) continue;

    rows.push({
      ...plan,
      subjectId,
      subjectName: subjectNames.get(subjectId) || 'Subject',
    });
  }

  rows.sort((a, b) => {
    const aReq = a.requiredPercentPerRemaining ?? 999;
    const bReq = b.requiredPercentPerRemaining ?? 999;
    if (aReq !== bReq) return bReq - aReq;
    return a.currentAveragePercent - b.currentAveragePercent;
  });

  return rows;
}
