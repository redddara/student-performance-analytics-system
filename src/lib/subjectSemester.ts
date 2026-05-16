/** Subject catalog semester labels (stored on `subjects.semester`). */
export const SUBJECT_SEMESTER_FIRST = '1st Sem';
export const SUBJECT_SEMESTER_SECOND = '2nd Sem';

/** Map catalog semester text → numeric grade semester (1 or 2). */
export function subjectSemesterToGradeSemester(semester?: string | null): number | null {
  const s = String(semester ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith('2') || s.includes('2nd')) return 2;
  if (s.startsWith('1') || s.includes('1st')) return 1;
  return null;
}

/** Map numeric grade semester → catalog label. */
export function gradeSemesterToSubjectSemester(semester: number): string {
  return semester === 2 ? SUBJECT_SEMESTER_SECOND : SUBJECT_SEMESTER_FIRST;
}

export function gradeSemesterDisplayLabel(semester: number): string {
  return semester === 2 ? '2nd Semester' : '1st Semester';
}

export function getSubjectGradeSemester(subject: { semester?: string | null } | null | undefined): number | null {
  if (!subject) return null;
  return subjectSemesterToGradeSemester(subject.semester);
}

export function gradeSemesterMatchesSubject(
  gradeSemester: number,
  subject: { semester?: string | null } | null | undefined
): boolean {
  const expected = getSubjectGradeSemester(subject);
  if (expected == null) return true;
  return gradeSemester === expected;
}

export function subjectSemesterMismatchMessage(
  subject: { name?: string; semester?: string | null },
  gradeSemester: number
): string {
  const expected = getSubjectGradeSemester(subject);
  const name = subject.name?.trim() || 'This subject';
  if (expected == null) {
    return `${name} has no catalog semester; choose semester 1 or 2 manually.`;
  }
  return `${name} is a ${subject.semester ?? gradeSemesterToSubjectSemester(expected)} subject — grades must use ${gradeSemesterDisplayLabel(expected)}, not ${gradeSemesterDisplayLabel(gradeSemester)}.`;
}
