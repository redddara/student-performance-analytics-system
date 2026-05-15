import { getGradeRemarks, getGradeStatus, parseGradeInput, toGradePoint } from './supabase';

export interface GradeSpreadsheetRow {
  student_name?: string;
  student_id?: string;
  semester?: number;
  quarter?: number;
  grade?: number | string;
}

export interface EnrolledStudentLite {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
}

export interface ExistingGradeLite {
  id: string;
  student_id: string;
  semester: number;
  quarter: number;
  grade_status?: string | null;
  grade?: number | null;
}

export type StudentMatchStrategy = 'split_first_last' | 'full_name';

export interface BulkGradePreviewRow {
  /** 1-based data row index in the sheet (first body row after header = 1). */
  dataRowNumber: number;
  /** Raw identifiers from file (for troubleshooting). */
  rawIdentifier: string;
  studentId: string | null;
  resolvedName: string;
  semester: number;
  quarter: number;
  numericGrade: number | null;
  remarks: string | null;
  gradeStatus: 'passed' | 'failed' | null;
  ok: boolean;
  errorMessage: string | null;
  existingGradeId: string | null;
  existingGradeDisplay: number | string | null;
}

export function quarterLabel(quarter: number): string {
  const labels = ['—', 'Prelim', 'Midterm', 'Pre-Finals', 'Finals'];
  return labels[quarter] || `Q${quarter}`;
}

function existingKey(studentId: string, semester: number, quarter: number) {
  return `${studentId}|${semester}|${quarter}`;
}

export function buildExistingGradesLookup(rows: ExistingGradeLite[]): Map<string, ExistingGradeLite> {
  const m = new Map<string, ExistingGradeLite>();
  for (const r of rows) {
    m.set(existingKey(r.student_id, r.semester, r.quarter), r);
  }
  return m;
}

export function resolveBulkGradeStudent(
  row: GradeSpreadsheetRow,
  enrolled: EnrolledStudentLite[],
  strategy: StudentMatchStrategy
): { studentId: string | null; enrolledMatch: EnrolledStudentLite | null } {
  const rawId = row.student_id != null ? String(row.student_id).trim() : '';
  if (rawId) {
    const match = enrolled.find((s) => s.id === rawId);
    return { studentId: rawId, enrolledMatch: match ?? null };
  }

  const rawName = row.student_name != null ? String(row.student_name).trim() : '';
  if (!rawName) {
    return { studentId: null, enrolledMatch: null };
  }

  let byName: EnrolledStudentLite | undefined;
  if (strategy === 'full_name') {
    const n = rawName.toLowerCase();
    byName = enrolled.find(
      (s) => `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim().toLowerCase() === n
    );
  } else {
    const nameParts = rawName.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] ?? '';
    const lastName = nameParts.slice(1).join(' ');
    byName = enrolled.find(
      (s) =>
        (s.first_name ?? '').toLowerCase() === firstName.toLowerCase() &&
        (s.last_name ?? '').toLowerCase() === lastName.toLowerCase()
    );
  }

  return byName ? { studentId: byName.id, enrolledMatch: byName } : { studentId: null, enrolledMatch: null };
}

function formatStudentDisplay(s: EnrolledStudentLite): string {
  return `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || 'Student';
}

function parseGradeValue(raw: unknown): number | null {
  if (raw === '' || raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return parseGradeInput(raw);
  }
  return parseGradeInput(String(raw));
}

/** Build preview rows — no database writes. */
export function buildBulkGradePreview(
  spreadsheetRows: GradeSpreadsheetRow[],
  opts: {
    enrolled: EnrolledStudentLite[];
    strategy: StudentMatchStrategy;
    defaultSemester: number;
    defaultQuarter: number;
    existingLookup: Map<string, ExistingGradeLite>;
  }
): BulkGradePreviewRow[] {
  const { enrolled, strategy, defaultSemester, defaultQuarter, existingLookup } = opts;
  const out: BulkGradePreviewRow[] = [];

  for (let i = 0; i < spreadsheetRows.length; i++) {
    const row = spreadsheetRows[i];
    const dataRowNumber = i + 1;
    const rawIdentifier =
      [row.student_name != null ? String(row.student_name).trim() : '', row.student_id != null ? String(row.student_id).trim() : '']
        .filter(Boolean)
        .join(' · ') || '—';

    const semester = Number(row.semester);
    const resolvedSemester = Number.isFinite(semester) && semester > 0 ? semester : defaultSemester;
    const quarterRaw = Number(row.quarter);
    const resolvedQuarter =
      Number.isFinite(quarterRaw) && quarterRaw > 0 ? quarterRaw : defaultQuarter;

    const { studentId: resolvedId, enrolledMatch } = resolveBulkGradeStudent(row, enrolled, strategy);
    let studentId = resolvedId;

    let resolvedName =
      rawIdentifier !== '—' ? String(row.student_name ?? row.student_id ?? rawIdentifier).trim() : '—';

    if (enrolledMatch) {
      resolvedName = formatStudentDisplay(enrolledMatch);
    } else if (resolvedId && !row.student_name) {
      resolvedName = resolvedId;
    }

    let errorMessage: string | null = null;
    let ok = true;

    if (!studentId) {
      ok = false;
      errorMessage = `Student not found: ${row.student_name ?? row.student_id ?? 'missing name/ID'}`;
      studentId = null;
    }

    const numericGrade = parseGradeValue(row.grade);
    if (ok && numericGrade == null) {
      ok = false;
      errorMessage = `Invalid grade (use grade point 1.00–5.00 or percentage 0–100)`;
    }

    let remarks: string | null = null;
    let gradeStatus: 'passed' | 'failed' | null = null;
    let existingGradeId: string | null = null;
    let existingGradeDisplay: number | string | null = null;

    if (ok && studentId != null && numericGrade != null) {
      const gradePoint = toGradePoint(numericGrade);
      remarks = getGradeRemarks(gradePoint);
      gradeStatus = getGradeStatus(gradePoint);

      const existing = existingLookup.get(existingKey(studentId, resolvedSemester, resolvedQuarter));
      if (existing) {
        existingGradeId = existing.id;
        existingGradeDisplay = existing.grade_status === 'inc' ? 'INC' : existing.grade ?? null;
        if (existing.grade_status === 'inc') {
          ok = false;
          gradeStatus = null;
          remarks = null;
          errorMessage = `Existing grade is INC — teachers cannot change this row`;
        }
      }
    }

    out.push({
      dataRowNumber,
      rawIdentifier,
      studentId,
      resolvedName,
      semester: resolvedSemester,
      quarter: resolvedQuarter,
      numericGrade: numericGrade != null ? toGradePoint(numericGrade) : null,
      remarks,
      gradeStatus,
      ok,
      errorMessage,
      existingGradeId,
      existingGradeDisplay,
    });
  }

  return out;
}
