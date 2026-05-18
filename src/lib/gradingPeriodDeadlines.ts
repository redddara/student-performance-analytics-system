import { supabase } from './supabase';
import { gradingPeriodLabel } from './gradingPeriods';

export type GradingPeriodDeadline = {
  id: string;
  school_year_id: string;
  semester: number;
  period: number;
  deadline_at: string;
};

export async function applyGradingPeriodDeadlineLocks(): Promise<void> {
  await supabase.rpc('apply_grading_period_deadline_locks');
}

export async function fetchGradingPeriodDeadlines(
  schoolYearId: string
): Promise<GradingPeriodDeadline[]> {
  const { data, error } = await supabase
    .from('grading_period_deadlines')
    .select('id, school_year_id, semester, period, deadline_at')
    .eq('school_year_id', schoolYearId)
    .order('semester')
    .order('period');
  if (error) throw error;
  return (data || []) as GradingPeriodDeadline[];
}

export function findPeriodDeadline(
  deadlines: GradingPeriodDeadline[],
  semester: number,
  period: number
): GradingPeriodDeadline | undefined {
  return deadlines.find((d) => d.semester === semester && d.period === period);
}

export function isPeriodPastDeadline(
  deadlines: GradingPeriodDeadline[],
  semester: number,
  period: number,
  now: Date = new Date()
): boolean {
  const row = findPeriodDeadline(deadlines, semester, period);
  if (!row?.deadline_at) return false;
  return new Date(row.deadline_at).getTime() <= now.getTime();
}

export function periodDeadlineMessage(semester: number, period: number): string {
  return `${gradingPeriodLabel(period)} (Semester ${semester}) submission deadline has passed. Grades for this period are locked. Contact an admin if you need an extension.`;
}

export function formatDeadlineDisplay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/** Local datetime string for `<input type="datetime-local">` */
export function deadlineToInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function inputValueToDeadlineIso(localValue: string): string | null {
  if (!localValue.trim()) return null;
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

const MS_DAY = 86_400_000;
const UPCOMING_WINDOW_DAYS = 60;
const PASSED_RECENT_DAYS = 30;

function semesterLabel(semester: number): string {
  return semester === 1 ? '1st Semester' : '2nd Semester';
}

function daysUntilPhrase(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

export type TeacherDeadlineNotification = {
  id: string;
  kind: 'upcoming' | 'due_soon' | 'passed';
  title: string;
  body: string;
  actionPath: string;
  sortKey: number;
};

/** Notifications for teachers about open and recently closed grading period deadlines. */
export function buildTeacherDeadlineNotifications(
  deadlines: GradingPeriodDeadline[],
  now: Date = new Date()
): TeacherDeadlineNotification[] {
  const nowMs = now.getTime();
  const items: TeacherDeadlineNotification[] = [];

  for (const d of deadlines) {
    const at = new Date(d.deadline_at);
    if (Number.isNaN(at.getTime())) continue;

    const diffMs = at.getTime() - nowMs;
    const periodLabel = gradingPeriodLabel(d.period);
    const semLabel = semesterLabel(d.semester);
    const when = formatDeadlineDisplay(d.deadline_at);
    const actionPath = `/teacher/grades?semester=${d.semester}`;

    if (diffMs < 0) {
      const daysSince = Math.floor(-diffMs / MS_DAY);
      if (daysSince > PASSED_RECENT_DAYS) continue;
      items.push({
        id: `deadline:passed:${d.semester}:${d.period}`,
        kind: 'passed',
        title: `${periodLabel} deadline passed`,
        body: `${semLabel} · ${periodLabel} grades are now locked. Contact an admin if you still need to submit or correct grades.`,
        actionPath,
        sortKey: at.getTime() + 1_000_000_000,
      });
    } else {
      const daysUntil = Math.ceil(diffMs / MS_DAY);
      if (daysUntil > UPCOMING_WINDOW_DAYS) continue;
      const dueSoon = daysUntil <= 3;
      items.push({
        id: `deadline:open:${d.semester}:${d.period}`,
        kind: dueSoon ? 'due_soon' : 'upcoming',
        title: dueSoon ? `${periodLabel} due ${daysUntilPhrase(daysUntil)}` : `Submit ${periodLabel} grades`,
        body: `${semLabel} · Deadline: ${when}. Enter and submit grades before the deadline to avoid automatic lock.`,
        actionPath,
        sortKey: at.getTime(),
      });
    }
  }

  return items.sort((a, b) => a.sortKey - b.sortKey);
}
