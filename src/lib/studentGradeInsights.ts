import {
  computeSubjectFinalAverage,
  formatGradePoint,
  getGradeRemarks,
  isPassing,
} from './gradingScale';

export type GradeRecord = {
  grade?: number | null;
  grade_status?: string;
  quarter?: number;
  subject_id?: string;
  school_year_id?: string | null;
  semester?: number;
};

export function subjectGradeBucketKey(g: GradeRecord): string {
  return `${g.subject_id ?? ''}:${g.school_year_id ?? 'null'}:${g.semester ?? 0}`;
}

export function groupGradesBySubjectBucket(grades: GradeRecord[]): Map<string, GradeRecord[]> {
  const map = new Map<string, GradeRecord[]>();
  for (const g of grades) {
    if (!g.subject_id) continue;
    const key = subjectGradeBucketKey(g);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(g);
  }
  return map;
}

/** Final subject grade = official percent average → grade point (matches class record). */
export function computeSubjectFinalGrade(grades: GradeRecord[]): number | null {
  const summary = computeSubjectFinalAverage(grades);
  if (summary.status === 'inc') return null;
  return summary.gradePoint;
}

export function isSubjectPassingByFinalGrade(grades: GradeRecord[]): boolean {
  const summary = computeSubjectFinalAverage(grades);
  return summary.status === 'passed';
}

export function countPassingSubjectsByFinalGrade(grades: GradeRecord[]): number {
  const buckets = groupGradesBySubjectBucket(grades);
  let count = 0;
  for (const bucket of buckets.values()) {
    if (isSubjectPassingByFinalGrade(bucket)) count++;
  }
  return count;
}

export type SubjectInsightFields = {
  strength: string;
  strengthReason: string;
  improve: string;
  improveReason: string;
  suggestion: string;
  suggestionReason: string;
};

const QUARTER_LABELS: Record<number, string> = {
  1: 'Prelim',
  2: 'Midterm',
  3: 'Pre-Finals',
  4: 'Finals',
};

export function getSubjectInsights(grades: GradeRecord[], subjectName: string): SubjectInsightFields {
  const final = computeSubjectFinalGrade(grades);
  const name = subjectName || 'This subject';
  const validGrades = grades.filter((g) => g.grade_status !== 'inc' && g.grade != null);
  const hasFinals = validGrades.some((g) => g.quarter === 4);

  if (final == null) {
    return {
      strength: '—',
      strengthReason: 'No graded quarters recorded yet.',
      improve: '—',
      improveReason: 'Complete at least one quarter grade to see feedback.',
      suggestion: '—',
      suggestionReason: 'Insights appear once your teacher posts grades for this subject.',
    };
  }

  const gp = final;
  const remarks = getGradeRemarks(gp);
  const passing = isPassing(gp);

  let strength = '—';
  let strengthReason = 'Final grade is not in the excellent range yet (below 85% average).';
  let improve = '—';
  let improveReason = 'You are meeting the passing requirement for this subject.';
  let suggestion = 'Keep steady';
  let suggestionReason = 'Maintain consistent study habits across all quarters.';

  if (gp <= 2.25) {
    strength = 'Strong';
    strengthReason = `${name} has a final grade of ${formatGradePoint(gp)} (${remarks}) — at or above the 85% very satisfactory level.`;
    improve = '—';
    improveReason = 'No major gaps identified for this subject.';
    suggestion = 'Maintain';
    suggestionReason = 'Keep reviewing regularly so you stay on track for excellent standing.';
  } else if (passing) {
    strength = 'Passing';
    strengthReason = `${name} has a final grade of ${formatGradePoint(gp)} (${remarks}), which meets the passing standard (75%).`;
    if (gp > 2.75) {
      improve = 'Can improve';
      improveReason = `Your final grade (${formatGradePoint(gp)}) is passing but below the 85% very satisfactory range.`;
    } else {
      improve = '—';
      improveReason = 'You are passing with satisfactory marks overall.';
    }
    suggestion = 'Aim higher';
    suggestionReason = 'Review weaker quarters and target a final average of 2.25 or better (85%).';
  } else {
    strength = '—';
    strengthReason = 'Final grade is below passing; see Areas to Improve.';
    improve = 'Below passing';
    improveReason = `${name} has a final grade of ${formatGradePoint(gp)} (${remarks}), below the 75% passing threshold.`;
    if (!hasFinals && validGrades.length > 0) {
      suggestion = 'Strong Finals';
      suggestionReason =
        'Finals is not posted yet. A higher Finals score can still raise your subject average — prioritize review for the last quarter.';
    } else {
      suggestion = 'Get support';
      suggestionReason =
        'Meet with your teacher for remediation, review past assessments, and add extra study time for this subject.';
    }
  }

  const weakQuarters = validGrades.filter((g) => g.quarter && !isPassing(Number(g.grade)));
  if (weakQuarters.length > 0) {
    const weakNames = weakQuarters
      .map((g) => QUARTER_LABELS[g.quarter!] || `Q${g.quarter}`)
      .join(', ');
    if (improve === '—') {
      improve = 'Weak quarters';
      improveReason = `${weakNames} scored below passing and lowered your final average.`;
    } else if (!improveReason.includes(weakNames)) {
      improveReason = `${improveReason} Weak quarters: ${weakNames}.`;
    }
  }

  return { strength, strengthReason, improve, improveReason, suggestion, suggestionReason };
}
