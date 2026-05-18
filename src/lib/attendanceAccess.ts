import { isScheduledClassDay } from './classSchedule';

export type AttendanceAccessStatus = 'pending' | 'approved' | 'rejected';

export type AttendanceAccessRequest = {
  id: string;
  subject_id: string;
  attendance_date: string;
  requested_by?: string | null;
  reason: string;
  status: AttendanceAccessStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  used_at?: string | null;
  created_at?: string;
};

export type AttendanceEditBlockReason =
  | 'allowed'
  | 'no_class'
  | 'off_schedule'
  | 'pending_access'
  | 'rejected_access'
  | 'locked';

export function resolveAttendanceEditAccess(params: {
  classDays?: string | null;
  dateIso: string;
  sessionType: 'class' | 'no_class';
  sessionLocked: boolean;
  accessRequest: AttendanceAccessRequest | null;
}): { canEdit: boolean; reason: AttendanceEditBlockReason } {
  const { classDays, dateIso, sessionType, sessionLocked, accessRequest } = params;

  if (sessionType === 'no_class') {
    return { canEdit: false, reason: 'no_class' };
  }

  const onSchedule = isScheduledClassDay(dateIso, classDays);
  const approvedUnused =
    accessRequest?.status === 'approved' && !accessRequest.used_at;

  if (!onSchedule) {
    if (approvedUnused) {
      return { canEdit: true, reason: 'allowed' };
    }
    if (accessRequest?.status === 'pending') {
      return { canEdit: false, reason: 'pending_access' };
    }
    if (accessRequest?.status === 'rejected') {
      return { canEdit: false, reason: 'rejected_access' };
    }
    return { canEdit: false, reason: 'off_schedule' };
  }

  if (sessionLocked && !approvedUnused) {
    return { canEdit: false, reason: 'locked' };
  }

  return { canEdit: true, reason: 'allowed' };
}

export function attendanceEditBlockMessage(reason: AttendanceEditBlockReason): string {
  switch (reason) {
    case 'no_class':
      return 'This date is marked as no class.';
    case 'off_schedule':
      return 'This date is not on the subject’s weekly schedule. Request access from an admin to enter attendance.';
    case 'pending_access':
      return 'Your access request is pending admin approval.';
    case 'rejected_access':
      return 'Your access request was declined. Contact an admin if you still need to enter attendance.';
    case 'locked':
      return 'Attendance for this date is locked after saving. Request access from an admin to make changes.';
    default:
      return '';
  }
}
