export type StudentStatus = 'active' | 'inactive' | 'graduated' | 'transferred';

export const STUDENT_STATUS_OPTIONS: { value: StudentStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'graduated', label: 'Graduated' },
  { value: 'transferred', label: 'Transferred' },
];

export const STUDENT_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All students' },
  { value: 'active', label: 'Active only' },
  { value: 'alumni', label: 'Inactive / alumni (non-active)' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'graduated', label: 'Graduated' },
  { value: 'transferred', label: 'Transferred' },
] as const;

export function normalizeStudentStatus(value: unknown): StudentStatus {
  const v = String(value ?? 'active').toLowerCase();
  if (v === 'inactive' || v === 'graduated' || v === 'transferred') return v;
  return 'active';
}

export function isActiveStudentStatus(status: unknown): boolean {
  const s = normalizeStudentStatus(status);
  return s === 'active';
}

/** Students who should not appear in grade encoding, attendance rosters, or bulk upload. */
export function isEncodableStudent(status: unknown): boolean {
  return isActiveStudentStatus(status);
}

export function studentStatusLabel(status: unknown): string {
  return STUDENT_STATUS_OPTIONS.find((o) => o.value === normalizeStudentStatus(status))?.label ?? 'Active';
}

export function studentStatusBadgeVariant(
  status: unknown
): 'success' | 'warning' | 'danger' | 'default' {
  switch (normalizeStudentStatus(status)) {
    case 'active':
      return 'success';
    case 'graduated':
      return 'default';
    case 'transferred':
      return 'warning';
    case 'inactive':
    default:
      return 'danger';
  }
}

export function matchesStudentStatusFilter(
  status: unknown,
  filter: string
): boolean {
  if (!filter) return true;
  const normalized = normalizeStudentStatus(status);
  if (filter === 'active') return normalized === 'active';
  if (filter === 'alumni') return normalized !== 'active';
  return normalized === filter;
}

/** Sync users.is_dropout when enrollment status changes (inactive = locked login). */
export function dropoutFlagForStudentStatus(status: StudentStatus): boolean {
  return status === 'inactive';
}

export function loginBlockedMessage(status: StudentStatus): string {
  switch (status) {
    case 'inactive':
      return 'Your account is marked inactive and cannot sign in. Please contact an administrator.';
    case 'graduated':
      return 'Your account is marked as graduated. Portal access is no longer available.';
    case 'transferred':
      return 'Your account is marked as transferred. Please contact an administrator if you need assistance.';
    default:
      return 'Your account cannot sign in at this time. Please contact an administrator.';
  }
}
