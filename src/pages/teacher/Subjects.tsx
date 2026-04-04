import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Button, Input, Select, Table, Modal, Spinner } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, getGradeRemarks } from '../../lib/supabase';

export default function TeacherSubjectsPage() {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [subjectId] = useState(searchParams.get('id'));
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [gradeForm, setGradeForm] = useState({ semester: 1, quarter: 1, grade: '' });

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    if (subjectId) {
      loadSubjectDetails(subjectId);
    }
  }, [subjectId]);

  const loadSubjects = async () => {
    const { data } = await supabase
      .from('subjects')
      .select('*, course:courses(*)')
      .eq('teacher_id', user?.id);
    setMySubjects(data || []);
    if (data && data.length > 0 && !subjectId) {
      setSelectedSubject(data[0]);
      loadSubjectDetails(data[0].id);
    }
    setLoading(false);
  };

  const loadSubjectDetails = async (sid: string) => {
    const subject = mySubjects.find(s => s.id === sid) || await supabase.from('subjects').select('*, course:courses(*)').eq('id', sid).single();
    setSelectedSubject(subject.data || subject);

    // Get enrolled students
    const { data: studentSubjects } = await supabase
      .from('student_subjects')
      .select('*, student:students(*, user:users(*), course:courses(*))')
      .eq('subject_id', sid);

    setEnrolledStudents(studentSubjects || []);

    // Get grades for this subject
    const { data: gradesData } = await supabase
      .from('grades')
      .select('*')
      .eq('subject_id', sid);
    setGrades(gradesData || []);
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    const gradeValue = parseFloat(gradeForm.grade);
    if (isNaN(gradeValue) || gradeValue < 0 || gradeValue > 100) {
      alert('Please enter a valid grade (0-100)');
      return;
    }

    // Check if grade exists
    const existingGrade = grades.find(g => 
      g.student_id === selectedStudent?.id && 
      g.semester === gradeForm.semester && 
      g.quarter === gradeForm.quarter
    );

    if (existingGrade) {
      await supabase.from('grades').update({
        grade: gradeValue,
        remarks: getGradeRemarks(gradeValue),
      }).eq('id', existingGrade.id);
    } else {
      await supabase.from('grades').insert({
        student_id: selectedStudent.id,
        subject_id: selectedSubject.id,
        semester: gradeForm.semester,
        quarter: gradeForm.quarter,
        grade: gradeValue,
        remarks: getGradeRemarks(gradeValue),
      });
    }

    setShowGradeModal(false);
    loadSubjectDetails(selectedSubject.id);
  };

  const getStudentGrade = (studentId: string, semester: number, quarter: number) => {
    const grade = grades.find(g => 
      g.student_id === studentId && g.semester === semester && g.quarter === quarter
    );
    return grade?.grade ? `${grade.grade} (${getGradeRemarks(grade.grade)})` : '-';
  };

  if (loading) {
    return <DashboardLayout title="My Subjects"><Spinner size="lg" /></DashboardLayout>;
  }

  return (
    <DashboardLayout title="My Subjects">
      <div className="mb-6">
        <Select
          label="Select Subject"
          value={`${subjectId || ''}`}
          onChange={e => window.location.href = `/teacher/subjects?id=${e.target.value}`}
          options={mySubjects.map(s => ({ value: `${s.id}`, label: `${s.name} - ${s.course?.name}` }))}
        />
      </div>

      {selectedSubject && (
        <>
          <GlassCard className="p-4 sm:p-6 mb-6">
            <h2 className="text-xl font-semibold text-[#800000] mb-2">{selectedSubject.name}</h2>
            <p className="text-gray-600">{selectedSubject.course?.name} • {selectedSubject.year_level} • {selectedSubject.semester}</p>
            <p className="text-sm text-gray-500 mt-2">Enrolled Students: {enrolledStudents.length}</p>
          </GlassCard>

          <GlassCard className="p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-[#800000] mb-4">Student Grades</h3>
            <Table headers={['Student', 'Section', '1st Sem Prelim', '1st Sem Midterm', '1st Sem Prefinals', '1st Sem Finals', '2nd Sem Prelim', '2nd Sem Midterm', '2nd Sem Prefinals', '2nd Sem Finals', 'Actions']}>
              {enrolledStudents.map(es => (
                <tr key={es.id} className="hover:bg-white/20">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {es.student?.first_name} {es.student?.last_name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{es.student?.section || '-'}</td>
                  {[1, 2].map(sem => [1, 2, 3, 4].map(q => (
                    <td key={`${sem}-${q}`} className="px-4 py-3 text-gray-600">
                      {getStudentGrade(es.student?.id, sem, q)}
                    </td>
                  )))}
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedStudent(es.student); setShowGradeModal(true); }}>
                      Add/Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
            {enrolledStudents.length === 0 && <p className="text-center text-gray-500 py-8">No students enrolled</p>}
          </GlassCard>
        </>
      )}

      <Modal isOpen={showGradeModal} onClose={() => setShowGradeModal(false)} title={`Grade: ${selectedStudent?.first_name} ${selectedStudent?.last_name}`}>
        <form onSubmit={handleSaveGrade} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="Semester" value={`${gradeForm.semester}`} onChange={e => setGradeForm({ ...gradeForm, semester: parseInt(e.target.value) })} options={[{ value: "1", label: '1st Semester' }, { value: "2", label: '2nd Semester' }]} />
            <Select label="Quarter" value={`${gradeForm.quarter}`} onChange={e => setGradeForm({ ...gradeForm, quarter: parseInt(e.target.value) })} options={[{ value: "1", label: 'Prelim' }, { value: "2", label: 'Midterm' }, { value: "3", label: 'Pre-Finals' }, { value: "4", label: 'Finals' }]} />
          </div>
          <Input label="Grade (0-100)" type="number" min="0" max="100" value={gradeForm.grade} onChange={e => setGradeForm({ ...gradeForm, grade: e.target.value })} required placeholder="Enter grade" />
          <div className="flex gap-4">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowGradeModal(false)}>Cancel</Button>
            <Button type="submit" className="flex-1">Save Grade</Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}

