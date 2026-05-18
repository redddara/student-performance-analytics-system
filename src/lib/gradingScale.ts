/** Official grade-point scale (lower is better). */

export interface GradeScaleEntry {
  gradePoint: number;
  minPercent: number;
  maxPercent: number;
  remarks: string;
}

/** Matches institutional grade sheet: percent range → grade point → remarks. */
export const GRADE_SCALE: GradeScaleEntry[] = [
  { gradePoint: 1.0, minPercent: 98, maxPercent: 100, remarks: 'EXCELLENT' },
  { gradePoint: 1.25, minPercent: 95, maxPercent: 97, remarks: 'VERY GOOD' },
  { gradePoint: 1.5, minPercent: 92, maxPercent: 94, remarks: 'VERY GOOD' },
  { gradePoint: 1.75, minPercent: 89, maxPercent: 91, remarks: 'SATISFACTORY' },
  { gradePoint: 2.0, minPercent: 86, maxPercent: 88, remarks: 'SATISFACTORY' },
  { gradePoint: 2.25, minPercent: 83, maxPercent: 85, remarks: 'SATISFACTORY' },
  { gradePoint: 2.5, minPercent: 80, maxPercent: 82, remarks: 'SATISFACTORY' },
  { gradePoint: 2.75, minPercent: 77, maxPercent: 79, remarks: 'SATISFACTORY' },
  { gradePoint: 3.0, minPercent: 75, maxPercent: 76, remarks: 'FAIR' },
  { gradePoint: 5.0, minPercent: 0, maxPercent: 74, remarks: 'FAILED OR CONDITIONAL' },
];

export const VALID_GRADE_POINTS = GRADE_SCALE.map((e) => e.gradePoint);

export function percentageToGradePoint(percent: number): number {
  const p = Math.round(percent);
  if (p >= 98) return 1.0;
  if (p >= 95) return 1.25;
  if (p >= 92) return 1.5;
  if (p >= 89) return 1.75;
  if (p >= 86) return 2.0;
  if (p >= 83) return 2.25;
  if (p >= 80) return 2.5;
  if (p >= 77) return 2.75;
  if (p >= 75) return 3.0;
  return 5.0;
}

/** Legacy rows may store percentage (0–100); normalize to grade point. */
export function toGradePoint(value: number): number {
  if (!Number.isFinite(value)) return 5.0;
  if (value > 5) return percentageToGradePoint(value);
  return snapToGradePoint(value);
}

export function snapToGradePoint(value: number): number {
  let best = VALID_GRADE_POINTS[0];
  let bestDiff = Math.abs(value - best);
  for (const gp of VALID_GRADE_POINTS) {
    const diff = Math.abs(value - gp);
    if (diff < bestDiff) {
      best = gp;
      bestDiff = diff;
    }
  }
  return best;
}

export function getScaleEntry(value: number): GradeScaleEntry {
  const gp = toGradePoint(value);
  return GRADE_SCALE.find((e) => e.gradePoint === gp) ?? GRADE_SCALE[GRADE_SCALE.length - 1];
}

export function getGradeRemarks(value: number): string {
  return getScaleEntry(value).remarks;
}

export function getGradeStatus(value: number): 'passed' | 'failed' {
  const gp = toGradePoint(value);
  return gp <= 3.0 && gp !== 5.0 ? 'passed' : 'failed';
}

export function isPassing(value: number): boolean {
  return getGradeStatus(value) === 'passed';
}

/** Legacy rows stored grade point; map to a percent only for old data. */
export function gradePointToDisplayPercent(gradePoint: number): number {
  const entry = getScaleEntry(gradePoint);
  if (entry.gradePoint === 5.0) return entry.maxPercent;
  return Math.round((entry.minPercent + entry.maxPercent) / 2);
}

/** Percent shown in inputs / class record (preserves teacher-entered percentage). */
export function displayGradePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value > 5) return Math.round(value);
  return gradePointToDisplayPercent(value);
}

/** @deprecated Use displayGradePercent */
export const storedGradeToPercent = displayGradePercent;

/** Value to persist: percentage when teacher entered 0–100, else grade point. */
export function gradeValueForStorage(raw: string | number): number | null {
  if (raw === '' || raw == null) return null;
  const v = typeof raw === 'number' ? raw : parseFloat(String(raw).trim());
  if (!Number.isFinite(v)) return null;
  if (v > 5) {
    if (v < 0 || v > 100) return null;
    return Math.round(v);
  }
  return parseGradeInput(raw);
}

export function averagePercentToGradePoint(percentages: number[]): number | null {
  if (percentages.length === 0) return null;
  const avg = percentages.reduce((sum, p) => sum + p, 0) / percentages.length;
  return percentageToGradePoint(avg);
}

export interface SubjectFinalAverageResult {
  averagePercent: number | null;
  gradePoint: number | null;
  status: 'passed' | 'failed' | 'inc';
  quarterCount: number;
}

/** Final subject average from quarter rows — matches teacher class record logic. */
export function computeSubjectFinalAverage(
  quarterGrades: { grade?: number | null; grade_status?: string | null }[]
): SubjectFinalAverageResult {
  const quarterCount = quarterGrades.length;
  if (quarterGrades.some((g) => g.grade_status === 'inc')) {
    return { averagePercent: null, gradePoint: null, status: 'inc', quarterCount };
  }

  const percents = quarterGrades
    .filter((g) => g.grade_status !== 'inc' && g.grade != null)
    .map((g) => displayGradePercent(Number(g.grade)));

  if (percents.length === 0) {
    return { averagePercent: null, gradePoint: null, status: 'failed', quarterCount };
  }

  const averagePercent =
    Math.round((percents.reduce((sum, p) => sum + p, 0) / percents.length) * 100) / 100;
  const gradePoint = percentageToGradePoint(averagePercent);
  const status = getGradeStatus(gradePoint);
  return { averagePercent, gradePoint, status, quarterCount };
}

/**
 * GWA = mean of official subject grade points, then snap to the institutional scale.
 * Result is always one of: 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 5 — never 3.33 or 4.88.
 */
export function calculateOfficialGwa(subjectGradePoints: number[]): number {
  const official = subjectGradePoints
    .filter((gp) => Number.isFinite(gp))
    .map((gp) => snapToGradePoint(gp));
  if (official.length === 0) return 0;
  const mean = official.reduce((sum, gp) => sum + gp, 0) / official.length;
  return snapToGradePoint(mean);
}

/** @deprecated Prefer subject finals + calculateOfficialGwa; snaps raw quarter mean as fallback. */
export function calculateGWA(grades: { grade: number }[]): number {
  if (grades.length === 0) return 0;
  const points = grades.map((g) => toGradePoint(g.grade));
  return calculateOfficialGwa(points);
}

/** Dean's List: every grade equivalent to 85% or higher (grade point ≤ 2.25). */
export function isDeanListEligible(grades: { grade: number }[]): boolean {
  if (grades.length === 0) return false;
  return grades.every((entry) => toGradePoint(entry.grade) <= 2.25);
}

export function formatGradeRange(entry: GradeScaleEntry): string {
  if (entry.gradePoint === 5.0) return '74 and below';
  if (entry.minPercent === entry.maxPercent) return String(entry.minPercent);
  return `${entry.minPercent}–${entry.maxPercent}`;
}

/** Official grade points always display with two decimals (1.00, 1.25, 3.00, 5.00, …). */
export function formatNumericGradePoint(gp: number): string {
  if (!Number.isFinite(gp)) return '—';
  const rounded = Math.round(gp * 100) / 100;
  return rounded.toFixed(2);
}

/** Format an official grade point (snaps to scale first). */
export function formatGradePoint(value: number): string {
  return formatNumericGradePoint(toGradePoint(value));
}

/** Format GWA — always snapped to an official grade point before display. */
export function formatGwa(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return formatNumericGradePoint(snapToGradePoint(value));
}

export function formatGradeDisplay(value: number): string {
  const gp = toGradePoint(value);
  const entry = getScaleEntry(gp);
  return `${formatGradePoint(value)} (${formatGradeRange(entry)})`;
}

export function parseGradeInput(raw: string | number): number | null {
  if (raw === '' || raw == null) return null;
  const v = typeof raw === 'number' ? raw : parseFloat(String(raw).trim());
  if (!Number.isFinite(v)) return null;
  if (v > 5) {
    if (v < 0 || v > 100) return null;
    return percentageToGradePoint(v);
  }
  if (v < 1 || v > 5) return null;
  return snapToGradePoint(v);
}

export function isValidGradeInput(raw: string | number): boolean {
  return parseGradeInput(raw) != null;
}

export interface GradeInputPreview {
  gradePoint: number;
  inputPercent: number | null;
  remarks: string;
  status: 'passed' | 'failed';
  rangeLabel: string;
}

/** Live preview for teacher entry: percent or grade point → official equivalent. */
export function previewGradeInput(raw: string | number): GradeInputPreview | null {
  if (raw === '' || raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const v = parseFloat(text);
  if (!Number.isFinite(v)) return null;

  const gradePoint = parseGradeInput(raw);
  if (gradePoint == null) return null;

  const entry = getScaleEntry(gradePoint);

  return {
    gradePoint,
    inputPercent: v > 5 ? Math.round(v) : gradePointToDisplayPercent(gradePoint),
    remarks: entry.remarks,
    status: getGradeStatus(gradePoint),
    rangeLabel: formatGradeRange(entry),
  };
}

export type RemarkCategory =
  | 'EXCELLENT'
  | 'VERY GOOD'
  | 'SATISFACTORY'
  | 'FAIR'
  | 'FAILED OR CONDITIONAL';

export function getRemarkCategory(value: number): RemarkCategory {
  return getScaleEntry(value).remarks as RemarkCategory;
}
