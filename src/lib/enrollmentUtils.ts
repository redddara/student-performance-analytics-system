import type { GradeRecord } from './studentGradeInsights';
import { getSubjectGradeSemester } from './subjectSemester';
import { studentPassedSubject, type SubjectPrerequisite } from './studentAcademicRules';

export type SubjectForEnrollment = {
  id: string;
  semester?: string | null;
};

/** Subjects a student may be enrolled in for their current semester and prerequisites. */
export function filterSubjectsForStudentEnrollment(
  subjects: SubjectForEnrollment[],
  opts: {
    currentSemester: number;
    grades: GradeRecord[];
    prerequisites: SubjectPrerequisite[];
  }
): SubjectForEnrollment[] {
  const { currentSemester, grades, prerequisites } = opts;
  return subjects.filter((sub) => {
    const catalogSem = getSubjectGradeSemester(sub);
    if (catalogSem != null && catalogSem !== currentSemester) return false;
    const prereqs = prerequisites.filter((p) => p.subject_id === sub.id);
    return prereqs.every((p) => studentPassedSubject(grades, p.prerequisite_subject_id));
  });
}
