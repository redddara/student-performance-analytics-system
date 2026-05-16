import type { OfficialGradeReportRow } from '../../lib/officialGradeReport';

type Props = {
  collegeName?: string;
  collegeSubtitle?: string;
  reportTitle: string;
  studentName: string;
  studentNumber: string;
  courseName: string;
  rows: OfficialGradeReportRow[];
  semesterGpa?: string;
};

export function StudentOfficialGradeReport({
  collegeName = 'PhilTech-GMA College',
  collegeSubtitle = 'Philippine Technological Institute of Science Arts and Trade - Central Inc.',
  reportTitle,
  studentName,
  studentNumber,
  courseName,
  rows,
  semesterGpa,
}: Props) {
  return (
    <div className="official-grade-report mx-auto max-w-5xl bg-white text-gray-900 shadow-lg print:shadow-none">
      <header className="border-b-2 border-gray-800 px-4 py-5 text-center sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-700 sm:text-sm">{collegeSubtitle}</p>
        <h1 className="mt-1 text-xl font-bold uppercase text-[#800000] sm:text-2xl">{collegeName}</h1>
        <h2 className="mt-4 text-base font-bold uppercase leading-snug text-gray-900 sm:text-lg">{reportTitle}</h2>
      </header>

      <div className="grid grid-cols-1 gap-1 border-b border-gray-400 bg-gray-100 px-3 py-3 text-xs font-bold uppercase sm:grid-cols-3 sm:px-4 sm:text-sm">
        <p>
          <span className="text-gray-600">Student name: </span>
          {studentName}
        </p>
        <p className="sm:text-center">
          <span className="text-gray-600">Course: </span>
          {courseName}
        </p>
        <p className="sm:text-right">
          <span className="text-gray-600">Student number: </span>
          {studentNumber}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-white text-[10px] font-bold uppercase sm:text-xs">
              <th className="border border-gray-400 px-2 py-2 text-left">Subject Code</th>
              <th className="border border-gray-400 px-2 py-2 text-left">Subject Description</th>
              <th className="border border-gray-400 px-2 py-2 text-center">Prelim</th>
              <th className="border border-gray-400 px-2 py-2 text-center">Midterm</th>
              <th className="border border-gray-400 px-2 py-2 text-center">Semi-Finals</th>
              <th className="border border-gray-400 px-2 py-2 text-center">Finals</th>
              <th className="border border-gray-400 px-2 py-2 text-center">Semestral Grades</th>
              <th className="border border-gray-400 px-2 py-2 text-center">GPA</th>
              <th className="border border-gray-400 px-2 py-2 text-center">Remarks</th>
              <th className="border border-gray-400 px-2 py-2 text-left">Teacher</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                  No grades recorded for this semester.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={`${row.subjectCode}-${i}`} className="text-gray-900">
                  <td className="border border-gray-300 px-2 py-1.5 font-mono font-semibold">{row.subjectCode}</td>
                  <td className="border border-gray-300 px-2 py-1.5">{row.subjectDescription}</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-center tabular-nums">{row.prelim}</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-center tabular-nums">{row.midterm}</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-center tabular-nums">{row.semiFinals}</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-center tabular-nums">{row.finals}</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-center font-semibold tabular-nums">
                    {row.semestralGrade}
                  </td>
                  <td className="border border-gray-300 px-2 py-1.5 text-center font-semibold tabular-nums">
                    {row.gpa}
                  </td>
                  <td className="border border-gray-300 px-2 py-1.5 text-center">{row.remarks}</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-xs uppercase">{row.teacher}</td>
                </tr>
              ))
            )}
          </tbody>
          {semesterGpa && rows.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 font-bold">
                <td colSpan={7} className="border border-gray-300 px-2 py-2 text-right uppercase">
                  Semester GPA
                </td>
                <td colSpan={3} className="border border-gray-300 px-2 py-2 text-center tabular-nums">
                  {semesterGpa}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <footer className="border-t border-gray-400 px-4 py-4 text-[10px] leading-relaxed text-gray-700 sm:px-6 sm:text-xs">
        <p className="font-semibold uppercase">Note:</p>
        <p className="mt-1">
          You may apply for the Dean&apos;s List if you meet the grade requirement. For questions or clarifications,
          visit the Registrar&apos;s Office.
        </p>
        <p className="mt-3 text-center text-[10px] text-gray-500">
          This is an unofficial copy for student reference. Official records are maintained by the registrar.
        </p>
      </footer>
    </div>
  );
}
