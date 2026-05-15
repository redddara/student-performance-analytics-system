/** Official grade-point scale (lower is better). */

export interface GradeScaleEntry {
  gradePoint: number;
  minPercent: number;
  maxPercent: number;
  remarks: string;
}

export const GRADE_SCALE: GradeScaleEntry[] = [
  { gradePoint: 1.0, minPercent: 98, maxPercent: 100, remarks: 'EXCELLENT' },
  { gradePoint: 1.25, minPercent: 95, maxPercent: 97, remarks: 'VERY GOOD' },
  { gradePoint: 1.5, minPercent: 92, maxPercent: 94, remarks: 'VERY GOOD' },
  { gradePoint: 1.75, minPercent: 89, maxPercent: 91, remarks: 'SATISFACTORY' },
  { gradePoint: 2.0, minPercent: 86, maxPercent: 88, remarks: 'SATISFACTORY' },
  { gradePoint: 2.25, minPercent: 83, maxPercent: 85, remarks: 'SATISFACTORY' },
  { gradePoint: 2.5, minPercent: 80, maxPercent: 82, remarks: 'SATISFACTORY' },
  { gradePoint: 2.75, minPercent: 77, maxPercent: 79, remarks: 'FAIR' },
  { gradePoint: 3.0, minPercent: 75, maxPercent: 76, remarks: 'PASSING' },
  { gradePoint: 5.0, minPercent: 0, maxPercent: 74, remarks: 'FAILED OR CONDITIONAL' },
];

export const VALID_GRADE_POINTS = GRADE_SCALE.map((e) => e.gradePoint);

/** Legacy rows may store percentage (0–100); normalize to grade point. */
export function toGradePoint(value: number): number {
  if (!Number.isFinite(value)) return 5.0;
  if (value > 5) return percentageToGradePoint(value);
  return snapToGradePoint(value);
}

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

export function getScaleEntry(gradePoint: number): GradeScaleEntry {
  const gp = snapToGradePoint(gradePoint);
  return GRADE_SCALE.find((e) => e.gradePoint === gp) ?? GRADE_SCALE[GRADE_SCALE.length - 1];
}

export function getGradeRemarks(gradePoint: number): string {
  return getScaleEntry(gradePoint).remarks;
}

export function getGradeStatus(gradePoint: number): 'passed' | 'failed' {
  const gp = toGradePoint(gradePoint);
  return gp <= 3.0 && gp !== 5.0 ? 'passed' : 'failed';
}

export function isPassing(gradePoint: number): boolean {
  return getGradeStatus(gradePoint) === 'passed';
}

export function calculateGWA(grades: { grade: number }[]): number {
  if (grades.length === 0) return 0;
  const total = grades.reduce((sum, g) => sum + toGradePoint(g.grade), 0);
  return Math.round((total / grades.length) * 100) / 100;
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

export function formatGradeDisplay(gradePoint: number): string {
  const gp = toGradePoint(gradePoint);
  const entry = getScaleEntry(gp);
  return `${gp.toFixed(2)} (${formatGradeRange(entry)})`;
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

export type RemarkCategory =
  | 'EXCELLENT'
  | 'VERY GOOD'
  | 'SATISFACTORY'
  | 'FAIR'
  | 'PASSING'
  | 'FAILED OR CONDITIONAL';

export function getRemarkCategory(gradePoint: number): RemarkCategory {
  return getScaleEntry(toGradePoint(gradePoint)).remarks as RemarkCategory;
}
