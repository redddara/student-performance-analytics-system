/** Institutional attendance scoring (matches grade sheet periods). */

export type AttendanceStatus = 'present' | 'late' | 'absent';

export const ATTENDANCE_SCORE = {
  present: 100,
  late: 50,
  absent: 0,
} as const;

export type AttendanceScore = (typeof ATTENDANCE_SCORE)[keyof typeof ATTENDANCE_SCORE];

import { GRADING_PERIODS, gradingPeriodLabel, gradingPeriodShortLabel } from './gradingPeriods';

/** Matches institutional grading periods (Prelims → Finals). */
export const ATTENDANCE_QUARTERS = GRADING_PERIODS;

export function quarterLabel(quarter: number | null | undefined): string {
  return gradingPeriodLabel(quarter);
}

export { gradingPeriodShortLabel };

export function scoreToStatus(score: number | null | undefined): AttendanceStatus {
  if (score === 100) return 'present';
  if (score === 50) return 'late';
  return 'absent';
}

export function statusToScore(status: AttendanceStatus): AttendanceScore {
  return ATTENDANCE_SCORE[status];
}

/** Normalize DB row (score column or legacy is_present). */
export function normalizeAttendanceScore(record: {
  score?: number | null;
  is_present?: boolean | null;
}): AttendanceScore {
  if (record.score === 100 || record.score === 50 || record.score === 0) {
    return record.score;
  }
  return record.is_present ? 100 : 0;
}

export function statusLabel(status: AttendanceStatus): string {
  if (status === 'present') return 'Present';
  if (status === 'late') return 'Late';
  return 'Absent';
}

export type EnrichedAttendanceRecord = {
  student_id: string;
  attendance_date: string;
  score: AttendanceScore;
  status: AttendanceStatus;
  quarter: number | null;
};

export function enrichAttendanceRecords(
  records: { student_id: string; attendance_date: string; score?: number | null; is_present?: boolean | null }[],
  sessions: { attendance_date: string; session_type?: string; quarter?: number | null }[],
  noClassDates: Set<string>
): EnrichedAttendanceRecord[] {
  const quarterByDate = new Map<string, number | null>();
  for (const session of sessions) {
    if (session.session_type === 'no_class') continue;
    quarterByDate.set(session.attendance_date, session.quarter ?? null);
  }

  return records
    .filter((r) => !noClassDates.has(r.attendance_date))
    .map((r) => {
      const score = normalizeAttendanceScore(r);
      return {
        student_id: r.student_id,
        attendance_date: r.attendance_date,
        score,
        status: scoreToStatus(score),
        quarter: quarterByDate.get(r.attendance_date) ?? null,
      };
    });
}

export interface StudentAttendanceSummary {
  studentId: string;
  present: number;
  late: number;
  absent: number;
  total: number;
  averageScore: number;
}

export function summarizeByStudent(
  records: EnrichedAttendanceRecord[]
): Map<string, StudentAttendanceSummary> {
  const map = new Map<string, StudentAttendanceSummary>();
  for (const r of records) {
    const bucket = map.get(r.student_id) || {
      studentId: r.student_id,
      present: 0,
      late: 0,
      absent: 0,
      total: 0,
      averageScore: 0,
    };
    bucket.total += 1;
    if (r.status === 'present') bucket.present += 1;
    else if (r.status === 'late') bucket.late += 1;
    else bucket.absent += 1;
    map.set(r.student_id, bucket);
  }
  for (const bucket of map.values()) {
    const scores = records.filter((r) => r.student_id === bucket.studentId).map((r) => r.score);
    bucket.averageScore =
      scores.length > 0
        ? Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10
        : 0;
  }
  return map;
}

export interface StudentPeriodScores {
  studentId: string;
  prelim: number | null;
  midterm: number | null;
  semiFinals: number | null;
  finals: number | null;
}

function averageScoreForQuarter(records: EnrichedAttendanceRecord[], quarter: number): number | null {
  const rows = records.filter((r) => r.quarter === quarter);
  if (rows.length === 0) return null;
  const avg = rows.reduce((sum, r) => sum + r.score, 0) / rows.length;
  return Math.round(avg * 10) / 10;
}

export function buildPeriodScoresByStudent(
  records: EnrichedAttendanceRecord[]
): Map<string, StudentPeriodScores> {
  const studentIds = [...new Set(records.map((r) => r.student_id))];
  const map = new Map<string, StudentPeriodScores>();
  for (const studentId of studentIds) {
    const studentRows = records.filter((r) => r.student_id === studentId);
    map.set(studentId, {
      studentId,
      prelim: averageScoreForQuarter(studentRows, 1),
      midterm: averageScoreForQuarter(studentRows, 2),
      semiFinals: averageScoreForQuarter(studentRows, 3),
      finals: averageScoreForQuarter(studentRows, 4),
    });
  }
  return map;
}
