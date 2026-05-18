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
    <div className="official-grade-report mx-auto max-w-5xl bg-white text-gray-900 shadow-lg print:mx-0 print:max-w-none print:shadow-none">
      <header className="border-b-2 border-gray-800 px-4 py-5 text-center sm:px-6 print:px-2 print:py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-700 sm:text-sm print:text-[9px] print:leading-tight">
          {collegeSubtitle}
        </p>
        <h1 className="mt-1 text-xl font-bold uppercase text-[#800000] sm:text-2xl print:text-lg">{collegeName}</h1>
        <h2 className="mt-4 text-base font-bold uppercase leading-snug text-gray-900 sm:text-lg print:mt-2 print:text-sm">
          {reportTitle}
        </h2>
      </header>

      <div className="grade-report-student-bar grid grid-cols-1 gap-1 border-b border-gray-400 bg-gray-100 px-3 py-3 text-xs font-bold uppercase sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] sm:gap-x-2 sm:px-4 sm:text-sm print:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] print:px-2 print:py-2 print:text-[8px] print:leading-tight">
        <p className="min-w-0 print:whitespace-nowrap">
          <span className="text-gray-600">Student name: </span>
          <span className="whitespace-nowrap">{studentName}</span>
        </p>
        <p className="min-w-0 sm:text-center print:text-center">
          <span className="text-gray-600">Course: </span>
          {courseName}
        </p>
        <p className="min-w-0 sm:text-right print:text-right print:whitespace-nowrap">
          <span className="text-gray-600">Student number: </span>
          <span className="whitespace-nowrap">{studentNumber}</span>
        </p>
      </div>

      <div className="grade-report-table-wrap overflow-x-auto print:overflow-visible">
        <table className="grade-report-table w-full min-w-[720px] border-collapse text-xs sm:text-sm print:min-w-0 print:table-fixed print:text-[7px]">
          <thead>
            <tr className="border-b border-gray-800 bg-white text-[10px] font-bold uppercase sm:text-xs print:text-[6px]">
              <th className="w-[7%] border border-gray-400 px-1 py-1.5 text-left sm:px-2 sm:py-2">Subject Code</th>
              <th className="w-[18%] border border-gray-400 px-1 py-1.5 text-left sm:px-2 sm:py-2">Subject Description</th>
              <th className="w-[7%] border border-gray-400 px-1 py-1.5 text-center sm:px-2 sm:py-2">Prelims</th>
              <th className="w-[7%] border border-gray-400 px-1 py-1.5 text-center sm:px-2 sm:py-2">Midterms</th>
              <th className="w-[8%] border border-gray-400 px-1 py-1.5 text-center sm:px-2 sm:py-2">Semi-Finals</th>
              <th className="w-[7%] border border-gray-400 px-1 py-1.5 text-center sm:px-2 sm:py-2">Finals</th>
              <th className="w-[9%] border border-gray-400 px-1 py-1.5 text-center sm:px-2 sm:py-2">Semestral Grades</th>
              <th className="w-[6%] border border-gray-400 px-1 py-1.5 text-center sm:px-2 sm:py-2">GPA</th>
              <th className="w-[8%] border border-gray-400 px-1 py-1.5 text-center sm:px-2 sm:py-2">Remarks</th>
              <th className="w-[23%] border border-gray-400 px-1 py-1.5 text-left sm:px-2 sm:py-2">Teacher</th>
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
                  <td className="border border-gray-300 px-1 py-1 font-mono font-semibold sm:px-2 sm:py-1.5">
                    {row.subjectCode}
                  </td>
                  <td className="border border-gray-300 px-1 py-1 sm:px-2 sm:py-1.5">{row.subjectDescription}</td>
                  <td className="border border-gray-300 px-1 py-1 text-center tabular-nums sm:px-2 sm:py-1.5">
                    {row.prelim}
                  </td>
                  <td className="border border-gray-300 px-1 py-1 text-center tabular-nums sm:px-2 sm:py-1.5">
                    {row.midterm}
                  </td>
                  <td className="border border-gray-300 px-1 py-1 text-center tabular-nums sm:px-2 sm:py-1.5">
                    {row.semiFinals}
                  </td>
                  <td className="border border-gray-300 px-1 py-1 text-center tabular-nums sm:px-2 sm:py-1.5">
                    {row.finals}
                  </td>
                  <td className="border border-gray-300 px-1 py-1 text-center font-semibold tabular-nums sm:px-2 sm:py-1.5">
                    {row.semestralGrade}
                  </td>
                  <td className="border border-gray-300 px-1 py-1 text-center font-semibold tabular-nums sm:px-2 sm:py-1.5">
                    {row.gpa}
                  </td>
                  <td className="border border-gray-300 px-1 py-1 text-center sm:px-2 sm:py-1.5">{row.remarks}</td>
                  <td className="border border-gray-300 px-1 py-1 text-[10px] uppercase sm:px-2 sm:py-1.5 sm:text-xs">
                    {row.teacher}
                  </td>
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
                <td className="border border-gray-300 px-2 py-2 text-center tabular-nums">{semesterGpa}</td>
                <td colSpan={2} className="border border-gray-300 px-2 py-2" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <footer className="border-t border-gray-400 px-4 py-4 text-[10px] leading-relaxed text-gray-700 sm:px-6 sm:text-xs print:px-2 print:py-3 print:text-[8px]">
        <p className="font-semibold uppercase">Note:</p>
        <p className="mt-1">
          You may apply for the Dean&apos;s List if you meet the grade requirement. For questions or clarifications,
          visit the Registrar&apos;s Office.
        </p>
        <p className="mt-3 text-center text-[10px] text-gray-500 print:text-[7px]">
          This is an unofficial copy for student reference. Official records are maintained by the registrar.
        </p>
      </footer>
    </div>
  );
}
