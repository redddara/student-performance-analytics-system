import { useState, useRef, useEffect } from 'react';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageIntro } from '../../components/layouts/PageIntro';
import { GlassCard, Button, Select, Spinner, MessageModal, type AppMessagePayload } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, getGradeRemarks } from '../../lib/supabase';

interface GradeRecord {
  student_name?: string;
  student_id?: string;
  subject_name?: string;
  subject_id?: string;
  semester?: number;
  quarter?: number;
  grade?: number;
}

export default function TeacherUploadPage() {
  const { user } = useAuthStore();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [selectedQuarter, setSelectedQuarter] = useState(1);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [appMessage, setAppMessage] = useState<AppMessagePayload | null>(null);

  const loadSubjects = async () => {
    const { data } = await supabase.from('subjects').select('*, course:courses(*)').eq('teacher_id', user?.id);
    setMySubjects(data || []);
    if (data?.length) setSelectedSubject(data[0].id);
  };

  useEffect(() => {
    loadSubjects();
  }, [user?.id]);

  const processFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSubject) {
      setAppMessage({
        title: 'Select a subject',
        message: 'Choose a subject before uploading a grade file.',
        variant: 'warning',
      });
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<GradeRecord>(sheet);

      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      // Get all enrolled students
      const { data: studentSubjects } = await supabase
        .from('student_subjects')
        .select('*, student:students(*, user:users(*))')
        .eq('subject_id', selectedSubject);

      const enrolledStudents = studentSubjects?.map(ss => ss.student) || [];

      for (const row of jsonData) {
        try {
          // Try to find student by name or ID
          let studentId = row.student_id;
          
          if (!studentId && row.student_name) {
            const nameParts = (row.student_name as string).trim().split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ');
            const student = enrolledStudents.find(s => 
              s.first_name?.toLowerCase() === firstName?.toLowerCase() &&
              s.last_name?.toLowerCase() === lastName?.toLowerCase()
            );
            studentId = student?.id;
          }

          if (!studentId) {
            failed++;
            errors.push(`Could not find student: ${row.student_name || row.student_id}`);
            continue;
          }

          const semester = row.semester || 1;
          const quarter = row.quarter || 1;
          const grade = parseFloat(row.grade as any);

          if (isNaN(grade) || grade < 0 || grade > 100) {
            failed++;
            errors.push(`Invalid grade for student ${row.student_name || row.student_id}`);
            continue;
          }

          // Check if grade exists
          const { data: existing } = await supabase
            .from('grades')
            .select('id')
            .eq('student_id', studentId)
            .eq('subject_id', selectedSubject)
            .eq('semester', semester)
            .eq('quarter', quarter)
            .limit(1);

          if (existing && existing.length > 0) {
            await supabase.from('grades').update({
              grade,
              remarks: getGradeRemarks(grade),
            }).eq('id', existing[0].id);
          } else {
            await supabase.from('grades').insert({
              student_id: studentId,
              subject_id: selectedSubject,
              semester,
              quarter,
              grade,
              remarks: getGradeRemarks(grade),
            });
          }

          success++;
        } catch (err: any) {
          failed++;
          errors.push(`Error processing row: ${err.message}`);
        }
      }

      setResults({ success, failed, errors: errors.slice(0, 10) });
    } catch (err: any) {
      setAppMessage({
        title: 'Upload failed',
        message: err.message || 'Could not read or process the file.',
        variant: 'error',
      });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const template = [
      { student_name: 'Juan Dela Cruz', semester: 1, quarter: 1, grade: 85 },
      { student_name: 'Juan Dela Cruz', semester: 1, quarter: 2, grade: 88 },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Grades');
    XLSX.writeFile(wb, 'grade_template.xlsx');
  };

  return (
    <DashboardLayout title="Upload Grades">
      <PageIntro
        title="Bulk grade import"
        subtitle="Upload a spreadsheet to add or update grades for students enrolled in your subject. Download the template for the correct column layout."
      />
      <GlassCard variant="plain" className="p-4 sm:p-6 mb-6">
        <h2 className="text-xl font-semibold text-[#800000] mb-1">Upload Excel file</h2>
        <p className="mb-4 text-sm leading-relaxed text-gray-600">
          Columns: student_name, semester (1 or 2), quarter (1–4), grade (0–100).
        </p>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Select
              label="Select Subject"
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
              options={mySubjects.map(s => ({ value: s.id, label: `${s.name} - ${s.course?.name}` }))}
            />
            <Select
              label="Semester"
              value={`${selectedSemester}`}
              onChange={e => setSelectedSemester(parseInt(e.target.value))}
              options={[
                { value: "1", label: '1st Semester' },
                { value: "2", label: '2nd Semester' }
              ]}
            />
            <Select
              label="Quarter"
              value={`${selectedQuarter}`}
              onChange={e => setSelectedQuarter(parseInt(e.target.value))}
              options={[
                { value: "1", label: 'Prelim' },
                { value: "2", label: 'Midterm' },
                { value: "3", label: 'Pre-Finals' },
                { value: "4", label: 'Finals' }
              ]}
            />
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={processFile}
              className="w-full min-w-0 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[#800000] file:text-white hover:file:bg-[#600000]"
            />
            <Button variant="primary" className="w-full shrink-0 sm:w-auto" onClick={downloadTemplate}>
              <Download className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              Download Template
            </Button>
          </div>

        </div>
      </GlassCard>

      {appMessage && (
        <MessageModal
          isOpen
          onClose={() => setAppMessage(null)}
          title={appMessage.title}
          message={appMessage.message}
          variant={appMessage.variant}
        />
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      )}

      {results && (
        <GlassCard variant="plain" className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-[#800000] mb-4">Upload Results</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center p-4 rounded-xl bg-green-50 border border-green-200">
              <p className="text-2xl font-bold text-green-600">{results.success}</p>
              <p className="text-sm text-green-600">Successfully Updated</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-red-50 border border-red-200">
              <p className="text-2xl font-bold text-red-600">{results.failed}</p>
              <p className="text-sm text-red-600">Failed</p>
            </div>
          </div>

          {results.errors.length > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-yellow-50 border border-yellow-200">
              <p className="font-semibold text-yellow-800 mb-2">Errors (showing first 10):</p>
              <ul className="text-sm text-yellow-700 list-disc list-inside">
                {results.errors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}
        </GlassCard>
      )}
    </DashboardLayout>
  );
}