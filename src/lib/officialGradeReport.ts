import { computeSubjectFinalAverage, displayGradePercent, getGradeStatus, snapToGradePoint } from './gradingScale';
import type { GradeRecord } from './studentGradeInsights';

export type OfficialGradeReportRow = {
  subjectCode: string;
  subjectDescription: string;
  prelim: string;
  midterm: string;
  semiFinals: string;
  finals: string;
  semestralGrade: string;
  gpa: string;
  remarks: string;
  teacher: string;
};

type SubjectMeta = {
  id?: string;
  code?: string | null;
  name?: string | null;
  teacher?: {
    name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
};

type GradeLike = GradeRecord & {
  subject_id?: string;
  quarter?: number;
  grade_status?: string | null;
  grade?: number | null;
};

function formatQuarterPercent(grade: GradeLike | undefined): string {
  if (!grade || grade.grade == null) return '—';
  if (grade.grade_status === 'inc') return 'INC';
  const pct = displayGradePercent(Number(grade.grade));
  return Number.isFinite(pct) ? pct.toFixed(2) : '—';
}

function formatTeacherLabel(teacher?: SubjectMeta['teacher']): string {
  if (!teacher) return '—';
  const last = String(teacher.last_name || teacher.name || '').trim();
  const first = String(teacher.first_name || '').trim();
  if (last) {
    const title = first.toLowerCase().startsWith('maria') || first.toLowerCase().startsWith('mrs') ? 'MRS.' : 'MR.';
    return `${title} ${last.toUpperCase()}`;
  }
  return String(teacher.name || '—').toUpperCase() || '—';
}

function formatRemarks(grades: GradeLike[]): string {
  if (grades.some((g) => g.grade_status === 'inc')) return 'INC';
  const summary = computeSubjectFinalAverage(grades);
  if (summary.status === 'inc') return 'INC';
  if (summary.gradePoint == null) return '—';
  return summary.status === 'passed' ? 'Passed' : 'Failed';
}

export function formatOfficialStudentName(
  firstName?: string | null,
  lastName?: string | null
): string {
  const last = String(lastName || '').trim().toUpperCase();
  const first = String(firstName || '').trim().toUpperCase();
  if (last && first) return `${last}, ${first}`;
  return last || first || '—';
}

export function formatReportTitle(
  gradeLevel?: string | null,
  semester: number,
  schoolYearName?: string | null
): string {
  const year = String(gradeLevel || '').trim().toUpperCase() || '—';
  const sem = semester === 2 ? '2ND' : '1ST';
  const ay = schoolYearName?.trim() || '—';
  return `${year}-${sem} SEMESTER COPY OF GRADES A.Y. ${ay}`;
}

export function buildOfficialGradeReportRows(
  subjectRows: { subject_id: string; subject?: SubjectMeta | null }[],
  grades: GradeLike[],
  scopeKey: string,
  semester: number,
  schoolYearId: string | null,
  legacyScopeKey: string
): OfficialGradeReportRow[] {
  const matchesYear = (g: GradeLike) => {
    if (scopeKey === legacyScopeKey) return !g.school_year_id;
    return g.school_year_id === schoolYearId;
  };

  return subjectRows.map(({ subject_id, subject }) => {
    const subjectGrades = grades.filter(
      (g) => g.subject_id === subject_id && g.semester === semester && matchesYear(g)
    );
    const byQuarter = (q: number) => subjectGrades.find((g) => g.quarter === q);

    const summary = computeSubjectFinalAverage(subjectGrades);
    const semestralDisplay =
      summary.status === 'inc'
        ? 'INC'
        : summary.averagePercent != null
          ? summary.averagePercent.toFixed(2)
          : '—';
    const gpaDisplay =
      summary.status === 'inc' || summary.gradePoint == null
        ? '—'
        : summary.gradePoint.toFixed(2);

    let remarks = formatRemarks(subjectGrades);
    if (remarks === 'Passed' && summary.gradePoint != null) {
      remarks = getGradeStatus(summary.gradePoint) === 'passed' ? 'Passed' : 'Failed';
    }

    return {
      subjectCode: subject?.code?.trim() || '—',
      subjectDescription: subject?.name?.trim() || '—',
      prelim: formatQuarterPercent(byQuarter(1)),
      midterm: formatQuarterPercent(byQuarter(2)),
      semiFinals: formatQuarterPercent(byQuarter(3)),
      finals: formatQuarterPercent(byQuarter(4)),
      semestralGrade: semestralDisplay,
      gpa: gpaDisplay,
      remarks,
      teacher: formatTeacherLabel(subject?.teacher),
    };
  });
}

export function computeReportSemesterGpa(rows: OfficialGradeReportRow[]): string {
  const points = rows
    .map((r) => (r.gpa === '—' || r.gpa === 'INC' ? null : Number(r.gpa)))
    .filter((n): n is number => n != null && Number.isFinite(n));
  if (points.length === 0) return '—';
  const avg = points.reduce((s, n) => s + n, 0) / points.length;
  return snapToGradePoint(avg).toFixed(2);
}
