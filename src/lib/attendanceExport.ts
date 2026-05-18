import * as XLSX from 'xlsx';
import { formatPersonDisplayName } from './personName';
import type { OfficialSection } from './officialSections';
import { officialSectionDisplayName } from './officialSections';
import {
  buildPeriodScoresByStudent,
  enrichAttendanceRecords,
  statusLabel,
  summarizeByStudent,
  type AttendanceStatus,
} from './attendance';
import { gradingPeriodLabel } from './gradingPeriods';

type StudentRow = {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  course?: { name?: string };
  grade_level?: string;
  section_id?: string | null;
  section?: string;
};

export function exportAttendanceWorkbook(options: {
  subjectName: string;
  records: { student_id: string; attendance_date: string; score?: number | null; is_present?: boolean | null }[];
  sessions: { attendance_date: string; session_type?: string; quarter?: number | null }[];
  students: StudentRow[];
  sectionsById: Map<string, OfficialSection>;
  noClassDates: Set<string>;
}): void {
  const { subjectName, records, sessions, students, sectionsById, noClassDates } = options;
  const enriched = enrichAttendanceRecords(records, sessions, noClassDates);
  const summaryByStudent = summarizeByStudent(enriched);
  const periodByStudent = buildPeriodScoresByStudent(enriched);

  const studentById = new Map(students.map((s) => [s.id, s]));

  const summaryRows = students.map((student) => {
    const stats = summaryByStudent.get(student.id);
    return {
      Subject: subjectName,
      Student: formatPersonDisplayName(student),
      Course: student.course?.name || '',
      'Year Level': student.grade_level || '',
      Section: officialSectionDisplayName(student, sectionsById),
      Present: stats?.present ?? 0,
      Late: stats?.late ?? 0,
      Absent: stats?.absent ?? 0,
      'Total Sessions': stats?.total ?? 0,
      'Attendance Score (avg)': stats?.averageScore ?? '',
    };
  });

  const periodRows = students.map((student) => {
    const period = periodByStudent.get(student.id);
    return {
      Subject: subjectName,
      Student: formatPersonDisplayName(student),
      Course: student.course?.name || '',
      Section: officialSectionDisplayName(student, sectionsById),
      Prelim: period?.prelim ?? '',
      Midterm: period?.midterm ?? '',
      'Semi-Finals': period?.semiFinals ?? '',
      Finals: period?.finals ?? '',
    };
  });

  const logRows = enriched
    .map((r) => {
      const student = studentById.get(r.student_id);
      return {
        Subject: subjectName,
        Date: r.attendance_date,
        Period: gradingPeriodLabel(r.quarter),
        Student: formatPersonDisplayName(student || {}),
        Course: student?.course?.name || '',
        Section: student ? officialSectionDisplayName(student, sectionsById) : '',
        Status: statusLabel(r.status as AttendanceStatus),
        Score: r.score,
      };
    })
    .sort((a, b) => String(a.Date).localeCompare(String(b.Date)) || String(a.Student).localeCompare(String(b.Student)));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Present Late Absent');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(periodRows), 'Period Scores');
  if (logRows.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(logRows), 'Daily Log');
  }

  const safeName = subjectName.replace(/\s+/g, '-').toLowerCase() || 'subject';
  XLSX.writeFile(wb, `attendance-${safeName}.xlsx`);
}
