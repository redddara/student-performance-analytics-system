/** Institutional grading periods (stored as `grades.quarter` / `period` 1–4). */

export const GRADING_PERIODS = [
  { value: 1, label: 'Prelims', shortLabel: 'Prelims' },
  { value: 2, label: 'Midterms', shortLabel: 'Midterms' },
  { value: 3, label: 'Semi-Finals', shortLabel: 'Semi-Finals' },
  { value: 4, label: 'Finals', shortLabel: 'Finals' },
] as const;

export type GradingPeriodValue = (typeof GRADING_PERIODS)[number]['value'];

export function gradingPeriodLabel(period: number | null | undefined): string {
  const row = GRADING_PERIODS.find((p) => p.value === period);
  return row?.label ?? '—';
}

export function gradingPeriodShortLabel(period: number | null | undefined): string {
  const row = GRADING_PERIODS.find((p) => p.value === period);
  return row?.shortLabel ?? '—';
}

/** @deprecated Use GRADING_PERIODS — kept for imports that still reference QUARTERS */
export const QUARTERS = GRADING_PERIODS;
