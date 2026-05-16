import { computeSubjectFinalAverage } from './gradingScale';
import type { GradeRecord } from './studentGradeInsights';
import { getSubjectGradeSemester, subjectSemesterToGradeSemester } from './subjectSemester';

export type SubjectPrerequisite = {
  subject_id: string;
  prerequisite_subject_id: string;
  minimum_grade?: number | null;
};

export type EnrolledSubjectLite = {
  id?: string;
  subject_id?: string;
  subject?: {
    id?: string;
    name?: string;
    year_level?: string | null;
    semester?: string | null;
  } | null;
};

export type StudentAcademicProfile = {
  grade_level?: string | null;
  current_semester?: number | null;
};

export type ClassifiedEnrollment = {
  enrollment: EnrolledSubjectLite;
  isBackSubject: boolean;
  /** Earlier catalog semester at the same year level (e.g. 1st sem while in 2nd sem). */
  isPastTermSubject?: boolean;
  hiddenReason?: 'future_semester' | 'prerequisite';
  unmetPrerequisiteNames?: string[];
};

const yearLevelRank = (value?: string | null) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized.startsWith('1')) return 1;
  if (normalized.startsWith('2')) return 2;
  if (normalized.startsWith('3')) return 3;
  if (normalized.startsWith('4')) return 4;
  return 0;
};

/** Lower year-level subject carried from a previous academic year. */
export function isBackSubject(
  student: StudentAcademicProfile,
  subject?: { year_level?: string | null } | null
): boolean {
  const subRank = yearLevelRank(subject?.year_level);
  const studentRank = yearLevelRank(student.grade_level);
  return subRank > 0 && studentRank > 0 && subRank < studentRank;
}

/** Failed 1st-semester subject at same year level while student is in 2nd sem (admin conditional advance). */
export function isFailedCarryOverBackSubject(
  student: StudentAcademicProfile,
  subject?: { id?: string; year_level?: string | null; semester?: string | null } | null,
  grades: GradeRecord[] = [],
  activeSchoolYearId: string | null = null
): boolean {
  if (!subject?.id || !student.grade_level) return false;
  if (yearLevelRank(subject.year_level) !== yearLevelRank(student.grade_level)) return false;

  const currentSemester = student.current_semester === 2 ? 2 : 1;
  if (currentSemester < 2) return false;

  const catalogSem = getSubjectGradeSemester(subject);
  if (catalogSem == null || catalogSem >= currentSemester) return false;

  const yearGrades = filterGradesForActiveSchoolYear(grades, activeSchoolYearId);
  if (!yearGrades.some((g) => g.subject_id === subject.id)) return false;

  return !studentPassedSubject(yearGrades, subject.id, {
    schoolYearId: activeSchoolYearId ?? undefined,
  });
}

/** Same year level, catalog semester before the student's current term. */
export function isPastTermSubject(
  student: StudentAcademicProfile,
  subject?: { year_level?: string | null; semester?: string | null } | null
): boolean {
  if (!student.grade_level || !subject) return false;
  if (yearLevelRank(subject.year_level) !== yearLevelRank(student.grade_level)) return false;
  const currentSemester = student.current_semester === 2 ? 2 : 1;
  const catalogSem = getSubjectGradeSemester(subject);
  return catalogSem != null && catalogSem < currentSemester;
}

/** Include graded subjects even when enrollment rows were dropped after term advance. */
export function mergeEnrollmentsWithGradeHistory(
  enrollments: EnrolledSubjectLite[],
  grades: GradeRecord[],
  student: StudentAcademicProfile
): EnrolledSubjectLite[] {
  const bySubjectId = new Map<string, EnrolledSubjectLite>();
  for (const e of enrollments) {
    const id = e.subject?.id || e.subject_id;
    if (id) bySubjectId.set(id, e);
  }

  for (const g of grades) {
    const id = g.subject_id;
    if (!id || bySubjectId.has(id)) continue;
    const sub = (g as GradeRecord & { subject?: EnrolledSubjectLite['subject'] }).subject;
    if (!sub) continue;
    if (yearLevelRank(sub.year_level) !== yearLevelRank(student.grade_level)) continue;
    bySubjectId.set(id, { subject_id: id, subject: sub });
  }

  return [...bySubjectId.values()];
}

export function isBackSubjectForEnrollment(
  student: StudentAcademicProfile,
  subject?: { id?: string; year_level?: string | null; semester?: string | null } | null,
  grades: GradeRecord[] = [],
  activeSchoolYearId: string | null = null
): boolean {
  return (
    isBackSubject(student, subject) ||
    isFailedCarryOverBackSubject(student, subject, grades, activeSchoolYearId)
  );
}

export function filterGradesForActiveSchoolYear<T extends { school_year_id?: string | null }>(
  grades: T[],
  activeSchoolYearId: string | null
): T[] {
  if (!activeSchoolYearId) return grades;
  return grades.filter((g) => g.school_year_id === activeSchoolYearId);
}

/** Passing = final subject standing (active year), not any single failed quarter row. */
export function studentPassedSubject(
  grades: GradeRecord[],
  subjectId: string,
  options?: { schoolYearId?: string | null }
): boolean {
  let subjectGrades = grades.filter((g) => g.subject_id === subjectId);
  if (options?.schoolYearId) {
    subjectGrades = subjectGrades.filter((g) => g.school_year_id === options.schoolYearId);
  }
  if (subjectGrades.length === 0) return false;

  const summary = computeSubjectFinalAverage(subjectGrades);
  if (summary.status === 'inc') return false;
  return summary.status === 'passed';
}

export function getUnmetPrerequisites(
  subjectId: string,
  prerequisites: SubjectPrerequisite[],
  grades: GradeRecord[],
  subjectNameById: Map<string, string>
): string[] {
  const unmet: string[] = [];
  for (const row of prerequisites) {
    if (row.subject_id !== subjectId) continue;
    if (!studentPassedSubject(grades, row.prerequisite_subject_id)) {
      unmet.push(subjectNameById.get(row.prerequisite_subject_id) || 'Required subject');
    }
  }
  return unmet;
}

export function classifyStudentEnrollments(
  student: StudentAcademicProfile,
  enrollments: EnrolledSubjectLite[],
  grades: GradeRecord[],
  prerequisites: SubjectPrerequisite[],
  activeSchoolYearId: string | null = null
): {
  visible: ClassifiedEnrollment[];
  hidden: ClassifiedEnrollment[];
  backSubjects: ClassifiedEnrollment[];
} {
  const currentSemester = student.current_semester === 2 ? 2 : 1;
  const subjectNameById = new Map<string, string>();
  for (const ss of enrollments) {
    const id = ss.subject?.id || ss.subject_id;
    if (id && ss.subject?.name) subjectNameById.set(id, ss.subject.name);
  }

  const mergedEnrollments = mergeEnrollmentsWithGradeHistory(enrollments, grades, student);

  const visible: ClassifiedEnrollment[] = [];
  const hidden: ClassifiedEnrollment[] = [];
  const backSubjects: ClassifiedEnrollment[] = [];

  for (const enrollment of mergedEnrollments) {
    const sub = enrollment.subject;
    if (!sub) continue;

    const subjectId = sub.id || enrollment.subject_id;
    const back = isBackSubjectForEnrollment(student, sub, grades, activeSchoolYearId);

    if (back) {
      const item: ClassifiedEnrollment = { enrollment, isBackSubject: true };
      backSubjects.push(item);
      visible.push(item);
      continue;
    }

    const pastTerm = isPastTermSubject(student, sub);
    if (pastTerm) {
      visible.push({ enrollment, isBackSubject: false, isPastTermSubject: true });
      continue;
    }

    const catalogSem = getSubjectGradeSemester(sub);
    if (catalogSem != null && catalogSem > currentSemester) {
      hidden.push({
        enrollment,
        isBackSubject: false,
        hiddenReason: 'future_semester',
      });
      continue;
    }

    if (subjectId) {
      const unmet = getUnmetPrerequisites(subjectId, prerequisites, grades, subjectNameById);
      if (unmet.length > 0) {
        hidden.push({
          enrollment,
          isBackSubject: false,
          hiddenReason: 'prerequisite',
          unmetPrerequisiteNames: unmet,
        });
        continue;
      }
    }

    visible.push({ enrollment, isBackSubject: false });
  }

  return { visible, hidden, backSubjects };
}

export function semesterLabelForStudent(currentSemester?: number | null): string {
  return currentSemester === 2 ? '2nd Semester' : '1st Semester';
}

export function subjectMatchesStudentSemester(
  subjectSemester: string | null | undefined,
  currentSemester: number
): boolean {
  const catalog = subjectSemesterToGradeSemester(subjectSemester);
  if (catalog == null) return true;
  return catalog === currentSemester;
}

export type SubjectCatalogLite = {
  id: string;
  name?: string | null;
  course_id?: string | null;
  year_level?: string | null;
  semester?: string | null;
};

/** Mirrors DB `student_can_advance_to_second_semester` for admin UI pre-checks. */
export function getSemesterAdvanceBlockers(
  student: StudentAcademicProfile & { course_id?: string | null; grade_level?: string | null },
  studentGrades: GradeRecord[],
  subjects: SubjectCatalogLite[],
  activeSchoolYearId: string | null = null
): string[] {
  const currentSemester = student.current_semester === 2 ? 2 : 1;
  if (currentSemester >= 2) return ['Already in 2nd semester'];
  if (!student.course_id || !student.grade_level) return ['Missing course or year level'];

  const yearGrades = filterGradesForActiveSchoolYear(studentGrades, activeSchoolYearId);

  const firstSemSubjects = subjects.filter(
    (sub) =>
      sub.course_id === student.course_id &&
      sub.year_level === student.grade_level &&
      getSubjectGradeSemester(sub) === 1
  );

  const blocking: string[] = [];
  for (const sub of firstSemSubjects) {
    const subjectGrades = yearGrades.filter((g) => g.subject_id === sub.id);
    if (subjectGrades.length === 0) continue;

    if (!studentPassedSubject(yearGrades, sub.id, { schoolYearId: activeSchoolYearId ?? undefined })) {
      blocking.push(sub.name || 'Required subject');
    }
  }

  return blocking;
}

export function studentCanAdvanceToSecondSemester(
  student: StudentAcademicProfile & { course_id?: string | null; grade_level?: string | null },
  studentGrades: GradeRecord[],
  subjects: SubjectCatalogLite[],
  activeSchoolYearId: string | null = null
): boolean {
  return getSemesterAdvanceBlockers(student, studentGrades, subjects, activeSchoolYearId).length === 0;
}
