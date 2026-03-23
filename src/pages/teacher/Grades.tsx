import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { useSearchParams } from 'react-router-dom';
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

// Helper functions for perfect cards
const getStudentInitials = (firstName: string, lastName: string) => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

const getQuarterColor = (grade: number | null | undefined) => {
  if (!grade) return 'from-gray-500 to-gray-600';
  if (grade >= 90) return 'from-emerald-500 to-emerald-600';
  if (grade >= 80) return 'from-blue-500 to-blue-600';
  if (grade >= 75) return 'from-amber-500 to-amber-600';
  if (grade >= 70) return 'from-orange-500 to-orange-600';
  return 'from-red-500 to-red-600';
};

const getQuarterStatus = (grade: number | null | undefined) => {
  if (!grade) return { label: 'Add', icon: Plus };
  if (grade >= 90) return { label: 'A', icon: Award };
  if (grade >= 80) return { label: 'B', icon: TrendingUp };
  if (grade >= 75) return { label: 'C', icon: CheckCircle };
  return { label: 'F', icon: XCircle };
};

  const TeacherGrades: React.FC = () => {
  const [searchParams] = useSearchParams();
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
      
      const urlSubject = searchParams.get('subject');
      if (urlSubject && teacherSubjects.some(s => s.id === urlSubject)) {
        setSelectedSubject(urlSubject);
      } else if (teacherSubjects.length > 0 && !selectedSubject) {
        setSelectedSubject(teacherSubjects[0].id);
      }
    }
  }, [user, subjects, getTeacherSubjects, searchParams, selectedSubject]);

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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-4 h-screen overflow-y-auto">
              {filteredStudents.map(es => {
                const student = es.student;
                const studentRecordId = student?.id;
                const studentGrades = getAllStudentGrades(studentRecordId);
                const averageGrade = getAverageGrade(studentGrades);
                const hasGrades = studentGrades.length > 0;
                const avgGradeNum = averageGrade ? parseFloat(averageGrade) : null;
                const gradeStatus = getGradeStatus(avgGradeNum);
                const initials = getStudentInitials(student?.first_name || '', student?.last_name || '');
                
                return (
                  <Card 
                    key={es.id} 
                    className="group/card w-full h-48 backdrop-blur-lg bg-white/10 border border-white/20 shadow-xl hover:shadow-2xl hover:shadow-gold-500/25 transition-all duration-300 hover:scale-105 hover:border-gold-500/50 rounded-xl overflow-hidden flex flex-col ${hasGrades ? 'ring-2 ring-gold-500/30' : 'ring-maroon-500/30'}"
                  >
                    {/* Landscape Header - Horizontal Layout */}
                    {/* Landscape Main Content - Grades + Subject */}
                    <div className="flex-1 flex flex-col p-3 gap-2">
                      {/* Top: Subject */}
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-gradient-to-r from-gold-500/40 to-amber-500/40 rounded-lg">
                          <BookOpen size={14} className="text-gold-400" />
                        </div>
                        <p className="text-white font-bold text-xs truncate flex-1">{es.subject?.name || 'Subject Name'}</p>
                      </div>
                      {/* Grades Grid */}
                      <div className="grid grid-cols-4 gap-1.5">
                        {[1, 2, 3, 4].map(q => {
                          const semester = 1;
                          const quarter = q;
                          const gradeData = getGradeByQuarter(studentGrades, semester, quarter);
                          const quarterGradeNum = gradeData?.grade || null;
                          const quarterColor = getQuarterColor(quarterGradeNum);
                          const quarterStatus = getQuarterStatus(quarterGradeNum);
                          return (
                            <button
                              key={`q${q}`}
                              onClick={() => gradeData ? openEditModal(gradeData) : openGradeModalWithQuarter(studentRecordId, semester, quarter)}
                              title={gradeData ? `Edit Q${q} (${quarterGradeNum})` : `Add Q${q} grade`}
                              className={`group/q h-10 rounded-lg border p-1.5 transition-all duration-200 flex flex-col items-center justify-center font-bold text-xs shadow-md hover:shadow-lg hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-gold-500/50 backdrop-blur-sm ${
                                gradeData 
                                  ? `bg-gradient-to-br ${quarterColor} text-white border-white/30 hover:border-white/50` 
                                  : 'bg-white/10 border-gray-500/40 hover:bg-white/20 hover:border-gray-400/60 text-gray-300'
                              }`}
                              aria-label={`Quarter ${q} grade: ${gradeData?.grade || 'Not set'}`}
                            >
                              <div className="text-[10px] opacity-90 uppercase tracking-wider mb-0.5">Q{q}</div>
                              <div className={`font-black leading-none ${
                                gradeData ? 'text-shadow-lg' : 'text-gray-400'
                              }`}>
                                {quarterGradeNum?.toFixed(0) || '--'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Footer: Progress + Add */}
                    <div className="p-2 pt-0 border-t border-white/20">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 pr-2">
                          <div className="flex items-center gap-1 mb-1 text-xs">
                            {hasGrades ? (
                              <>
                                <CheckCircle size={12} className="text-emerald-400" />
                                <span className="font-bold text-emerald-300">{studentGrades.length}/4</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle size={12} className="text-amber-400" />
                                <span className="font-bold text-amber-300">No Grades</span>
                              </>
                            )}
                          </div>
                          <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-emerald-500 to-green-500 h-full rounded-full transition-all" 
                              style={{width: `${(studentGrades.length / 4) * 100}%`}}
                            />
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          className="px-2.5 h-8 text-xs font-bold shadow-lg hover:shadow-gold-500/50"
                          onClick={() => openGradeModal(studentRecordId)}
                        >
                          <Plus size={12} /> 
                        </Button>
                      </div>
                    </div>

                    {/* Compact Subject */}
                    <div className="p-5 border-b border-white/20 bg-black/10">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-r from-gold-500/30 to-amber-500/30 rounded-xl backdrop-blur-sm">
                          <BookOpen size={18} className="text-gold-400" />
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Subject</p>
                          <p className="text-white font-bold text-lg md:text-xl truncate pr-2">{es.subject?.name || 'Subject Name'}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Perfect Quarter Grid */}
                    <div className="p-5">
                      <div className="grid grid-cols-4 gap-3">
                        {[1, 2, 3, 4].map(q => {
                          const semester = 1;
                          const quarter = q;
                          const gradeData = getGradeByQuarter(studentGrades, semester, quarter);
                          const quarterGradeNum = gradeData?.grade || null;
                          const quarterColor = getQuarterColor(quarterGradeNum);
                          const quarterStatus = getQuarterStatus(quarterGradeNum);
                          return (
                            <button
                              key={`q${q}`}
                              onClick={() => gradeData ? openEditModal(gradeData) : openGradeModalWithQuarter(studentRecordId, semester, quarter)}
                              title={gradeData ? `Edit Q${q} (${quarterGradeNum})` : `Add Q${q} grade`}
                              className={`group/btn h-16 rounded-2xl border-2 p-2 transition-all duration-200 flex flex-col items-center justify-center font-bold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-gold-500/50 backdrop-blur-sm ${
                                gradeData 
                                  ? `bg-gradient-to-br ${quarterColor} text-white border-white/30 hover:border-white/50` 
                                  : 'bg-white/10 border-gray-500/40 hover:bg-white/20 hover:border-gray-400/60 text-gray-300'
                              }`}
                              aria-label={`Quarter ${q} grade: ${gradeData?.grade || 'Not set'}`}
                            >
                              <div className="text-[11px] text-gray-200/80 uppercase tracking-wider mb-0.5 group-hover/btn:text-white/90">Q{q}</div>
                              <div className={`text-xl md:text-2xl font-black leading-none ${
                                gradeData ? 'drop-shadow-lg' : 'text-gray-400'
                              }`}>
                                {quarterGradeNum?.toFixed(0) || '--'}
                              </div>
                              <div className="text-[10px] font-bold opacity-90 mt-0.5">
                                {quarterStatus.label}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Perfect Footer */}
                    <div className="p-5 pt-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            {hasGrades ? (
                              <>
                                <CheckCircle size={16} className="text-emerald-400" />
                                <span className="text-sm font-bold text-emerald-300">
                                  {studentGrades.length}/4 Complete
                                </span>
                              </>
                            ) : (
                              <>
                                <AlertCircle size={16} className="text-amber-400" />
                                <span className="text-sm font-bold text-amber-300">
                                  No Grades
                                </span>
                              </>
                            )}
                          </div>
                          <div className="w-full bg-white/20 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-emerald-500 to-green-500 h-1.5 rounded-full transition-all duration-300" 
                              style={{width: `${(studentGrades.length / 4) * 100}%`}}
                            />
                          </div>
                        </div>
                        <Button 
                          onClick={() => openGradeModal(studentRecordId)} 
                          size="sm"
                          className="px-4 h-10 font-bold shadow-lg hover:shadow-gold-500/50 whitespace-nowrap"
                        >
                          <Plus size={16} className="mr-1" />Add
                        </Button>
                      </div>
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
