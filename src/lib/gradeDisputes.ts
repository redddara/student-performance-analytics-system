import { supabase } from './supabase';
import { displayGradePercent, formatGradeDisplay } from './gradingScale';
import { gradingPeriodLabel } from './gradingPeriods';
import { formatPersonDisplayName } from './personName';
import type { GradeDispute, GradeDisputeStatus } from '../types';

export type GradeDisputeWithDetails = GradeDispute & {
  grade?: {
    id: string;
    grade: number;
    quarter: number;
    semester: number;
    grade_status?: string;
    subject?: {
      id?: string;
      name?: string;
      code?: string;
      teacher_id?: string;
    };
    school_year?: { name?: string };
  };
  student?: {
    id: string;
    first_name?: string;
    last_name?: string;
    user?: { username?: string };
  };
};

export type DisputeNotification = {
  id: string;
  title: string;
  body: string;
  actionPath?: string;
  kind: 'dispute_pending' | 'dispute_resolved';
};

const DISPUTE_SELECT = `
  *,
  grade:grades(
    id, grade, quarter, semester, grade_status, school_year_id,
    subject:subjects(id, name, code, teacher_id),
    school_year:school_years(name)
  ),
  student:students(id, first_name, last_name, user:users(username))
`;

export function formatDisputedGradeDisplay(
  grade: number | null | undefined,
  gradeStatus?: string | null,
): string {
  if (gradeStatus === 'inc') return 'INC';
  if (grade == null || !Number.isFinite(Number(grade))) return '—';
  const n = Number(grade);
  if (n > 5) return displayGradePercent(n);
  return formatGradeDisplay(n);
}

export function disputeStatusLabel(status: GradeDisputeStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending review';
    case 'accepted':
      return 'Accepted — grade updated';
    case 'rejected':
      return 'Rejected';
    default:
      return status;
  }
}

export function disputeStatusBadgeVariant(
  status: GradeDisputeStatus,
): 'warning' | 'success' | 'danger' | 'info' {
  switch (status) {
    case 'pending':
      return 'warning';
    case 'accepted':
      return 'success';
    case 'rejected':
      return 'danger';
    default:
      return 'info';
  }
}

export function buildDisputeSummaryLine(d: GradeDisputeWithDetails): string {
  const subject = d.grade?.subject?.name || 'Subject';
  const period = gradingPeriodLabel(d.grade?.quarter);
  const sem = d.grade?.semester === 2 ? '2nd Sem' : '1st Sem';
  const recorded = formatDisputedGradeDisplay(d.disputed_grade ?? d.grade?.grade, d.grade?.grade_status);
  return `${subject} · ${sem} · ${period} · Recorded: ${recorded}`;
}

export async function fetchStudentDisputes(studentId: string): Promise<GradeDisputeWithDetails[]> {
  const { data, error } = await supabase
    .from('grade_disputes')
    .select(DISPUTE_SELECT)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as GradeDisputeWithDetails[];
}

export async function fetchTeacherDisputes(teacherId: string): Promise<GradeDisputeWithDetails[]> {
  const { data, error } = await supabase
    .from('grade_disputes')
    .select(DISPUTE_SELECT)
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as GradeDisputeWithDetails[];
}

export async function fetchPendingDisputeGradeIds(studentId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('grade_disputes')
    .select('grade_id')
    .eq('student_id', studentId)
    .eq('status', 'pending');
  if (error) throw error;
  return new Set((data || []).map((r: { grade_id: string }) => r.grade_id));
}

export async function submitGradeDispute(params: {
  gradeId: string;
  studentId: string;
  teacherId: string | null;
  reason: string;
  disputedGrade: number | null;
}): Promise<void> {
  const trimmed = params.reason.trim();
  if (!trimmed) throw new Error('Please describe why you believe this grade is incorrect.');

  const { error } = await supabase.from('grade_disputes').insert({
    grade_id: params.gradeId,
    student_id: params.studentId,
    teacher_id: params.teacherId,
    reason: trimmed,
    disputed_grade: params.disputedGrade,
    status: 'pending',
  });
  if (error) {
    if (error.code === '23505') {
      throw new Error('You already have a pending dispute for this grade. Wait for your teacher to respond.');
    }
    throw error;
  }
}

export async function acceptGradeDispute(params: {
  disputeId: string;
  gradeId: string;
  teacherResponse: string;
  correctedGrade: number;
  entryStatus: 'passed' | 'failed' | 'inc';
  getGradeRemarks: (v: number) => string;
  getGradeStatus: (v: number) => 'passed' | 'failed';
}): Promise<void> {
  const response = params.teacherResponse.trim() || 'Grade corrected per dispute review.';
  const gradePayload =
    params.entryStatus === 'inc'
      ? { grade: 0, remarks: 'INC', grade_status: 'inc' as const }
      : {
          grade: params.correctedGrade,
          remarks: params.getGradeRemarks(params.correctedGrade),
          grade_status: params.getGradeStatus(params.correctedGrade),
        };

  const { error: gradeError } = await supabase
    .from('grades')
    .update(gradePayload)
    .eq('id', params.gradeId);
  if (gradeError) throw gradeError;

  const { error: disputeError } = await supabase
    .from('grade_disputes')
    .update({
      status: 'accepted',
      teacher_response: response,
      corrected_grade: params.entryStatus === 'inc' ? null : params.correctedGrade,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', params.disputeId)
    .eq('status', 'pending');
  if (disputeError) throw disputeError;
}

export async function rejectGradeDispute(disputeId: string, teacherResponse: string): Promise<void> {
  const response = teacherResponse.trim();
  if (!response) throw new Error('Please provide an explanation when rejecting a dispute.');

  const { error } = await supabase
    .from('grade_disputes')
    .update({
      status: 'rejected',
      teacher_response: response,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', disputeId)
    .eq('status', 'pending');
  if (error) throw error;
}

export function buildTeacherDisputeNotifications(
  disputes: GradeDisputeWithDetails[],
): DisputeNotification[] {
  return disputes
    .filter((d) => d.status === 'pending')
    .slice(0, 10)
    .map((d) => {
      const studentName =
        formatPersonDisplayName({
          first_name: d.student?.first_name,
          last_name: d.student?.last_name,
        }) || d.student?.user?.username || 'Student';
      return {
        id: `dispute-pending:${d.id}`,
        kind: 'dispute_pending' as const,
        title: `${studentName} filed a grade dispute`,
        body: `${buildDisputeSummaryLine(d)} · ${d.reason.slice(0, 120)}${d.reason.length > 120 ? '…' : ''}`,
        actionPath: '/teacher/disputes',
      };
    });
}

export function buildStudentDisputeNotifications(
  disputes: GradeDisputeWithDetails[],
): DisputeNotification[] {
  return disputes
    .filter((d) => d.status === 'accepted' || d.status === 'rejected')
    .slice(0, 8)
    .map((d) => {
      const resolved = d.resolved_at ? new Date(d.resolved_at).getTime() : 0;
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      if (resolved < weekAgo) return null;
      const statusWord = d.status === 'accepted' ? 'accepted' : 'rejected';
      const detail =
        d.status === 'accepted' && d.corrected_grade != null
          ? `New grade: ${formatDisputedGradeDisplay(d.corrected_grade)}`
          : d.teacher_response?.slice(0, 100) || 'See your dispute history for details.';
      return {
        id: `dispute-resolved:${d.id}:${d.status}`,
        kind: 'dispute_resolved' as const,
        title: `Grade dispute ${statusWord}`,
        body: `${buildDisputeSummaryLine(d)} · ${detail}`,
        actionPath: '/student/grades',
      };
    })
    .filter((n): n is DisputeNotification => n != null);
}
