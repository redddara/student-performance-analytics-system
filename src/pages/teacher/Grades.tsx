import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { DashboardLayout } from '../../components/layouts';
import { Card, Button, Input, Select, Modal, Badge, LoadingSpinner } from '../../components/ui';
import { 
  ClipboardList, 
  Plus, 
  Search,
  Edit,
  Trash2,
  User,
  BookOpen,
  Filter,
  Loader2,
  AlertCircle,
  GraduationCap,
  Calendar,
  Award,
  CheckCircle,
  XCircle,
  TrendingUp
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const GRADE_LEVELS = [
  { value: 'all', label: 'All Year Levels' },
  { value: '1st-Year', label: '1st-Year' },
  { value: '2nd-Year', label: '2nd-Year' },
  { value: '3rd-Year', label: '3rd-Year' },
  { value: '4th-Year', label: '4th-Year' },
];

const SECTIONS = [
  { value: 'all', label: 'All Sections' },
  { value: '1m1', label: '1m1' },
  { value: '1m2', label: '1m2' },
  { value: '1n1', label: '1n1' },
  { value: '1n2', label: '1n2' },
  { value: '2m1', label: '2m1' },
  { value: '2m2', label: '2m2' },
  { value: '2n1', label: '2n1' },
  { value: '2n2', label: '2n2' },
  { value: '3m1', label: '3m1' },
  { value: '3m2', label: '3m2' },
  { value: '3n1', label: '3n1' },
  { value: '3n2', label: '3n2' },
  { value: '4m1', label: '4m1' },
  { value: '4m2', label: '4m2' },
  { value: '4n1', label: '4n1' },
  { value: '4n2', label: '4n2' },
];

// Loading Skeleton Component
const CardSkeleton = () => (
  <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 animate-pulse">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-12 h-12 rounded-full bg-white/10"></div>
      <div className="flex-1">
        <div className="h-4 bg-white/10 rounded w-32 mb-2"></div>
        <div className="h-3 bg-white/10 rounded w-24"></div>
      </div>
    </div>
    <div className="space-y-2">
      <div className="h-3 bg-white/10 rounded w-full"></div>
      <div className="h-3 bg-white/10 rounded w-3/4"></div>
      <div className="h-6 bg-white/10 rounded w-16 mt-3"></div>
    </div>
  </div>
);

const TeacherGrades: React.FC = () => {
  const { user, subjects, grades, getTeacherSubjects, fetchGrades, students, fetchStudents, fetchSubjects } = useStore();
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeLevelFilter, setGradeLevelFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [allGrades, setAllGrades] = useState<any[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  
  // Grade entry form
  const [gradeForm, setGradeForm] = useState({
    studentId: '',
    semester: '1',
    quarter: '1',
    grade: '',
    remarks: ''
  });

  // Edit grade form
  const [editGradeForm, setEditGradeForm] = useState({
    grade: '',
    semester: '1',
    quarter: '1',
    remarks: ''
  });

  // Initial data fetch
  useEffect(() => {
    const initData = async () => {
      setInitialLoading(true);
      try {
        await fetchStudents();
        await fetchGrades();
        await fetchSubjects();
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setInitialLoading(false);
      }
    };
    initData();
  }, []);

  // Set teacher subjects
  useEffect(() => {
    if (user && subjects.length > 0) {
      const teacherSubjects = getTeacherSubjects(user.id);
      setMySubjects(teacherSubjects);
      if (teacherSubjects.length > 0 && !selectedSubject) {
        setSelectedSubject(teacherSubjects[0].id);
      }
    }
  }, [user, subjects, getTeacherSubjects]);

  // Fetch enrolled students and grades when subject changes
  useEffect(() => {
    if (selectedSubject) {
      fetchEnrolledStudents();
      fetchAllGrades();
    }
  }, [selectedSubject]);

  const fetchEnrolledStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('student_subjects')
        .select('*, student:students(*, user:users(*)), subject:subjects(*)')
        .eq('subject_id', selectedSubject);
      
      if (error) {
        console.error('Error fetching enrolled students:', error);
        return;
      }
      
      console.log('Enrolled students data:', data);
      setEnrolledStudents(data || []);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const fetchAllGrades = async () => {
    try {
      const { data, error } = await supabase
        .from('grades')
        .select('*')
        .eq('subject_id', selectedSubject)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching grades:', error);
        return;
      }
      
      console.log('Grades for subject:', data);
      setAllGrades(data || []);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  // Get ALL grades for a student (all quarters and semesters)
  const getAllStudentGrades = (studentRecordId: string) => {
    if (!studentRecordId || allGrades.length === 0) return [];
    return allGrades
      .filter(g => g.student_id === studentRecordId)
      .sort((a, b) => {
        // Sort by semester, then by quarter
        if (a.semester !== b.semester) return a.semester - b.semester;
        return a.quarter - b.quarter;
      });
  };

  // Calculate average grade for a student
  const getAverageGrade = (grades: any[]) => {
    if (grades.length === 0) return null;
    const sum = grades.reduce((acc, g) => acc + (g.grade || 0), 0);
    return (sum / grades.length).toFixed(1);
  };

  // Get grade by quarter
  const getGradeByQuarter = (grades: any[], semester: number, quarter: number) => {
    return grades.find(g => g.semester === semester && g.quarter === quarter);
  };

  const handleEncodeGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from('grades').insert({
        student_id: gradeForm.studentId,
        subject_id: selectedSubject,
        semester: parseInt(gradeForm.semester),
        quarter: parseInt(gradeForm.quarter),
        grade: parseFloat(gradeForm.grade),
        remarks: gradeForm.remarks || null
      });

      if (error) {
        console.error('Error inserting grade:', error);
        alert('Error saving grade: ' + error.message);
        return;
      }

      await fetchAllGrades();
      setIsModalOpen(false);
      setGradeForm({
        studentId: '',
        semester: '1',
        quarter: '1',
        grade: '',
        remarks: ''
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await supabase.from('grades').update({
        grade: parseFloat(editGradeForm.grade),
        semester: parseInt(editGradeForm.semester),
        quarter: parseInt(editGradeForm.quarter),
        remarks: editGradeForm.remarks || null
      }).eq('id', selectedGrade.id);

      await fetchAllGrades();
      setIsEditModalOpen(false);
      setSelectedGrade(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGrade = async (gradeId: string) => {
    try {
      await supabase.from('grades').delete().eq('id', gradeId);
      await fetchAllGrades();
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting grade:', err);
    }
  };

  const openGradeModal = (studentRecordId: string) => {
    setGradeForm({ ...gradeForm, studentId: studentRecordId });
    setIsModalOpen(true);
  };

  // Open encode modal with pre-selected semester and quarter
  const openGradeModalWithQuarter = (studentRecordId: string, semester: number, quarter: number) => {
    setGradeForm({
      ...gradeForm,
      studentId: studentRecordId,
      semester: semester.toString(),
      quarter: quarter.toString()
    });
    setIsModalOpen(true);
  };

  const openEditModal = (grade: any) => {
    setSelectedGrade(grade);
    setEditGradeForm({
      grade: grade.grade.toString(),
      semester: grade.semester.toString(),
      quarter: grade.quarter.toString(),
      remarks: grade.remarks || ''
    });
    setIsEditModalOpen(true);
  };

  const filteredStudents = enrolledStudents.filter(es => {
    const student = es.student;
    if (!student) return false;
    const fullName = `${student.first_name || ''} ${student.last_name || ''}`.toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase());
    const matchesGradeLevel = gradeLevelFilter === 'all' || student.grade_level === gradeLevelFilter;
    const matchesSection = sectionFilter === 'all' || student.section === sectionFilter;
    return matchesSearch && matchesGradeLevel && matchesSection;
  });

  const getGradeStatus = (grade: number | null | undefined) => {
    if (grade === null || grade === undefined) return { label: 'No Grade', variant: 'warning' as const, icon: AlertCircle };
    if (grade >= 90) return { label: 'Excellent', variant: 'success' as const, icon: Award };
    if (grade >= 80) return { label: 'Very Good', variant: 'info' as const, icon: Award };
    if (grade >= 75) return { label: 'Passed', variant: 'success' as const, icon: CheckCircle };
    if (grade >= 70) return { label: 'Fair', variant: 'warning' as const, icon: AlertCircle };
    return { label: 'Failed', variant: 'danger' as const, icon: XCircle };
  };

  const getGradeColor = (grade: number | null | undefined) => {
    if (grade === null || grade === undefined) return 'from-gray-500 to-gray-600';
    if (grade >= 90) return 'from-green-500 to-emerald-600';
    if (grade >= 80) return 'from-blue-500 to-indigo-600';
    if (grade >= 75) return 'from-amber-500 to-yellow-600';
    if (grade >= 70) return 'from-orange-500 to-red-500';
    return 'from-red-500 to-red-700';
  };

  const getSemesterLabel = (sem: number) => sem === 1 ? '1st Semester' : '2nd Semester';
  const getQuarterLabel = (q: number) => {
    const labels = ['', '1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'];
    return labels[q] || `Q${q}`;
  };

  const selectedSubjectData = subjects.find(s => s.id === selectedSubject);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white">Student Grade Reports</h1>
            <p className="text-gray-300 mt-3 text-lg">Manage and track student performance</p>
          </div>
          <div className="flex items-center gap-2 text-base text-green-300 bg-green-500/20 px-6 py-3 rounded-xl border border-green-500/60">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
            <span className="font-semibold">System Ready</span>
          </div>
        </div>

        {/* Subject Selection */}
        <Card className="border-gold-500/60 bg-gold-500/5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4 flex-1">
              <div className="p-4 bg-gold-500/25 rounded-xl text-gold-400">
                <BookOpen size={28} />
              </div>
              <div>
                <p className="text-gray-300 text-sm font-bold uppercase tracking-wide">Current Subject</p>
                <p className="text-white font-bold text-2xl mt-1">
                  {selectedSubjectData?.name || 'Select a subject'}
                </p>
              </div>
            </div>
            <div className="w-full md:w-64">
              <Select
                label="Switch Subject"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                options={[
                  { value: '', label: 'Choose Subject...' },
                  ...mySubjects.map(s => ({ value: s.id, label: s.name }))
                ]}
              />
            </div>
          </div>
        </Card>

        {/* Filters */}
        {selectedSubject && !initialLoading && (
          <Card>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <Input
                    label="Search Students"
                    placeholder="Enter student name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    icon={<Search size={18} />}
                  />
                </div>
                <Select
                  label="Year Level"
                  value={gradeLevelFilter}
                  onChange={(e) => setGradeLevelFilter(e.target.value)}
                  options={GRADE_LEVELS}
                />
                <Select
                  label="Section"
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  options={SECTIONS}
                />
              </div>
              <div className="bg-black/30 rounded-xl p-4 border border-maroon-600/30 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <span className="text-gray-300 text-sm font-bold">Students Found</span>
                  <span className="text-white font-bold text-2xl">{filteredStudents.length} <span className="text-gray-400 text-base font-normal">of {enrolledStudents.length}</span></span>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-gray-300 text-sm font-bold">Grades Recorded</span>
                  <span className="text-gold-300 font-bold text-2xl">{allGrades.length} <span className="text-gray-400 text-base font-normal">entries</span></span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Students Grid - Card Layout */}
        {initialLoading ? (
          <div className="flex items-center justify-center min-h-96">
            <LoadingSpinner size="lg" text="Loading student records..." />
          </div>
        ) : selectedSubject ? (
          filteredStudents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredStudents.map(es => {
                const student = es.student;
                const studentRecordId = student?.id;
                const studentGrades = getAllStudentGrades(studentRecordId);
                const averageGrade = getAverageGrade(studentGrades);
                const hasGrades = studentGrades.length > 0;
                const avgGradeNum = averageGrade ? parseFloat(averageGrade) : null;
                const gradeStatus = getGradeStatus(avgGradeNum);
                
                return (
                  <Card 
                    key={es.id} 
                    className={`transition-all duration-300 hover:shadow-xl hover:shadow-gold-500/30 ${hasGrades ? 'border-gold-500/60' : 'border-maroon-600/50'}`}
                  >
                    {/* Card Header - Student Info */}
                    <div className="pb-6 border-b border-maroon-600/30">
                      <div className="flex items-start gap-6">
                        {/* Avatar with Grade */}
                        <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${getGradeColor(avgGradeNum)} flex flex-col items-center justify-center text-white font-bold shadow-lg flex-shrink-0`}>
                          {avgGradeNum ? (
                            <>
                              <span className="text-5xl leading-none">{averageGrade}</span>
                              <span className="text-xs font-normal opacity-90 mt-1">AVERAGE</span>
                            </>
                          ) : (
                            <>
                              <span className="text-5xl leading-none">--</span>
                              <span className="text-xs font-normal opacity-90 mt-1">NO GRADE</span>
                            </>
                          )}
                        </div>
                        
                        {/* Student Details */}
                        <div className="flex-1">
                          <h3 className="text-white font-bold text-2xl mb-3">
                            {student?.first_name || ''} {student?.last_name || ''}
                          </h3>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-black/30 rounded-lg p-3">
                              <p className="text-gray-400 text-xs font-bold uppercase mb-1">Year Level</p>
                              <p className="text-white font-bold text-lg">{student?.grade_level || 'N/A'}</p>
                            </div>
                            <div className="bg-black/30 rounded-lg p-3">
                              <p className="text-gray-400 text-xs font-bold uppercase mb-1">Section</p>
                              <p className="text-white font-bold text-lg">{student?.section || 'N/A'}</p>
                            </div>
                          </div>
                          <Badge 
                            variant={gradeStatus.variant} 
                            size="md"
                            className="inline-flex items-center gap-2"
                          >
                            <gradeStatus.icon size={16} />
                            {gradeStatus.label}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Subject & Grade Grid */}
                    <div className="py-6 border-b border-maroon-600/30">
                      <div className="flex items-center gap-3 mb-5">
                        <div className="p-2 bg-gold-500/25 rounded-lg">
                          <BookOpen size={20} className="text-gold-400" />
                        </div>
                        <div>
                          <p className="text-gray-300 text-xs font-bold uppercase">Subject</p>
                          <p className="text-white font-bold text-lg">{es.subject?.name || 'Subject'}</p>
                        </div>
                      </div>
                      
                      {/* Grade Grid - All 4 Quarters */}
                      <div className="grid grid-cols-4 gap-3">
                        {[1, 2, 3, 4].map(q => {
                          const semester = 1;
                          const quarter = q;
                          const gradeData = getGradeByQuarter(studentGrades, semester, quarter);
                          return (
                            <button
                              key={`q${q}`}
                              onClick={() => gradeData ? openEditModal(gradeData) : openGradeModalWithQuarter(studentRecordId, semester, quarter)}
                              className={`py-4 px-3 rounded-xl border-2 transition-all text-center font-semibold ${
                                gradeData 
                                  ? 'bg-gold-500/20 border-gold-500/60 hover:border-gold-500 hover:bg-gold-500/30' 
                                  : 'bg-white/5 border-maroon-600/40 hover:bg-white/10 hover:border-maroon-500/60'
                              }`}
                            >
                              <div className="text-xs text-gray-400 mb-2 uppercase">Q{q}</div>
                              <div className={`text-2xl font-bold ${
                                gradeData ? 'text-white' : 'text-gray-500'
                              }`}>
                                {gradeData?.grade || '--'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Card Footer - Status & Action */}
                    <div className="pt-6 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {hasGrades ? (
                          <div className="flex items-center gap-2 text-green-300 font-semibold">
                            <CheckCircle size={20} />
                            <span>{studentGrades.length} of 4 Recorded</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-yellow-300 font-semibold">
                            <AlertCircle size={20} />
                            <span>No Grades Yet</span>
                          </div>
                        )}
                      </div>
                      <Button 
                        onClick={() => openGradeModal(studentRecordId)} 
                        size="md"
                        className="ml-auto"
                      >
                        <Plus size={18} />
                        Add Grade
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <div className="text-center py-12">
                <Filter size={48} className="mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400 text-lg">No students match your filter criteria</p>
                <p className="text-gray-500 text-sm mt-2">Try adjusting your search or filters</p>
              </div>
            </Card>
          )
        ) : (
          <Card>
            <div className="text-center py-12">
              <BookOpen size={48} className="mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400 text-lg">Select a subject to view and manage grades</p>
              <p className="text-gray-500 text-sm mt-2">Choose a subject from the dropdown above</p>
            </div>
          </Card>
        )}
      </div>

      {/* Encode Grade Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Encode Student Grade"
      >
        <form onSubmit={handleEncodeGrade} className="space-y-4">
          <Select
            label="Quarter"
            value={gradeForm.quarter}
            onChange={(e) => setGradeForm({ ...gradeForm, quarter: e.target.value })}
            options={[
              { value: '1', label: '1st Quarter' },
              { value: '2', label: '2nd Quarter' },
              { value: '3', label: '3rd Quarter' },
              { value: '4', label: '4th Quarter' },
            ]}
          />
          <Input
            label="Grade (0-100)"
            type="number"
            min="0"
            max="100"
            value={gradeForm.grade}
            onChange={(e) => setGradeForm({ ...gradeForm, grade: e.target.value })}
            placeholder="Enter grade between 0-100"
            required
          />
          <Input
            label="Remarks (Optional)"
            value={gradeForm.remarks}
            onChange={(e) => setGradeForm({ ...gradeForm, remarks: e.target.value })}
            placeholder="e.g., Excellent work! Keep it up!"
          />
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? <Loader2 className="animate-spin" size={18} /> : 'Save Grade'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Grade Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setSelectedGrade(null); }}
        title="Edit Student Grade"
      >
        <form onSubmit={handleUpdateGrade} className="space-y-4">
          <Select
            label="Quarter"
            value={editGradeForm.quarter}
            onChange={(e) => setEditGradeForm({ ...editGradeForm, quarter: e.target.value })}
            options={[
              { value: '1', label: '1st Quarter' },
              { value: '2', label: '2nd Quarter' },
              { value: '3', label: '3rd Quarter' },
              { value: '4', label: '4th Quarter' },
            ]}
          />
          <Input
            label="Grade (0-100)"
            type="number"
            min="0"
            max="100"
            value={editGradeForm.grade}
            onChange={(e) => setEditGradeForm({ ...editGradeForm, grade: e.target.value })}
            required
          />
          <Input
            label="Remarks (Optional)"
            value={editGradeForm.remarks}
            onChange={(e) => setEditGradeForm({ ...editGradeForm, remarks: e.target.value })}
          />
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setIsEditModalOpen(false); setSelectedGrade(null); }} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? <Loader2 className="animate-spin" size={18} /> : 'Update Grade'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirm Delete"
      >
        <div className="text-center py-4">
          <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
          <p className="text-white text-lg mb-2">Are you sure you want to delete this grade?</p>
          <p className="text-gray-400 text-sm">This action cannot be undone. The student's grade will be removed.</p>
        </div>
        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)} className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={() => deleteConfirm && handleDeleteGrade(deleteConfirm)} 
            variant="danger"
            className="flex-1"
          >
            Delete Grade
          </Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default TeacherGrades;
