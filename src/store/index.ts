import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User, Course, Subject, Student, Grade, StudentSubject, AnalyticsData } from '../types';

interface AppState {
  user: User | null;
  isLoading: boolean;
  courses: Course[];
  subjects: Subject[];
  students: Student[];
  grades: Grade[];
  studentSubjects: StudentSubject[];
  analytics: AnalyticsData | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  fetchCourses: () => Promise<void>;
  fetchSubjects: () => Promise<void>;
  fetchStudents: () => Promise<void>;
  fetchGrades: () => Promise<void>;
  fetchStudentSubjects: () => Promise<void>;
  fetchAnalytics: () => Promise<void>;
  
  // CRUD Actions
  createCourse: (name: string) => Promise<void>;
  createSubject: (name: string, courseId: string, teacherId?: string) => Promise<void>;
  createStudent: (firstName: string, lastName: string, gradeLevel: string, section: string, courseId: string) => Promise<void>;
  createTeacher: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  createUser: (email: string, password: string, name: string, role: string) => Promise<{ success: boolean; error?: string }>;
  
  // Grade Actions
  encodeGrade: (studentId: string, subjectId: string, semester: number, quarter: number, grade: number, remarks?: string) => Promise<void>;
  updateGrade: (gradeId: string, grade: number, remarks?: string) => Promise<void>;
  
  // Enrollment Actions
  enrollStudentInSubject: (studentId: string, subjectId: string) => Promise<void>;
  unenrollStudentFromSubject: (studentId: string, subjectId: string) => Promise<void>;
  assignTeacherToSubject: (subjectId: string, teacherId: string) => Promise<void>;
  
  // Filtered Data
  getTeacherSubjects: (teacherId: string) => Subject[];
  getStudentGrades: (studentId: string) => Grade[];
  getSubjectGrades: (subjectId: string) => Grade[];
  calculateGWA: (studentId: string) => number;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  isLoading: false,
  courses: [],
  subjects: [],
  students: [],
  grades: [],
  studentSubjects: [],
  analytics: null,

  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),

  fetchCourses: async () => {
    const { data, error } = await supabase.from('courses').select('*').order('name');
    if (!error && data) set({ courses: data });
  },

  fetchSubjects: async () => {
    const { data, error } = await supabase
      .from('subjects')
      .select('*, course:courses(*), teacher:users!subjects_teacher_id_fkey(*)')
      .order('name');
    if (!error && data) set({ subjects: data as unknown as Subject[] });
  },

  fetchStudents: async () => {
    const { data, error } = await supabase
      .from('students')
      .select('*, user:users(*), course:courses(*)')
      .order('last_name');
    if (!error && data) set({ students: data as unknown as Student[] });
  },

  fetchGrades: async () => {
    const { data, error } = await supabase
      .from('grades')
      .select('*, student:students(*), subject:subjects(*)')
      .order('created_at', { ascending: false });
    if (!error && data) set({ grades: data as unknown as Grade[] });
  },

  fetchStudentSubjects: async () => {
    const { data, error } = await supabase
      .from('student_subjects')
      .select('*, student:students(*), subject:subjects(*, course:courses(*))')
      .order('created_at', { ascending: false });
    if (!error && data) set({ studentSubjects: data as unknown as StudentSubject[] });
  },

  fetchAnalytics: async () => {
    const { students, grades, subjects, courses } = get();
    
    const studentCount = students.length;
    const teacherCount = students.length > 0 ? Math.ceil(studentCount / 10) : 0;
    const subjectCount = subjects.length;
    const courseCount = courses.length;
    
    // Calculate GWA
    let totalGrade = 0;
    let gradeCount = 0;
    let passingCount = 0;
    let failingCount = 0;
    
    grades.forEach(g => {
      totalGrade += Number(g.grade);
      gradeCount++;
      if (g.grade >= 75) passingCount++;
      else failingCount++;
    });
    
    const averageGWA = gradeCount > 0 ? totalGrade / gradeCount : 0;
    const passingRate = gradeCount > 0 ? (passingCount / gradeCount) * 100 : 0;
    const failingRate = gradeCount > 0 ? (failingCount / gradeCount) * 100 : 0;
    
    // Grade distribution
    const gradeRanges = [
      { range: '90-100', min: 90, max: 100, count: 0 },
      { range: '85-89', min: 85, max: 89, count: 0 },
      { range: '80-84', min: 80, max: 84, count: 0 },
      { range: '75-79', min: 75, max: 79, count: 0 },
      { range: 'Below 75', min: 0, max: 74, count: 0 },
    ];
    
    grades.forEach(g => {
      const grade = Number(g.grade);
      gradeRanges.forEach(r => {
        if (grade >= r.min && grade <= r.max) r.count++;
      });
    });
    
    const analytics: AnalyticsData = {
      totalStudents: studentCount,
      totalTeachers: teacherCount,
      totalCourses: courseCount,
      totalSubjects: subjectCount,
      averageGWA: Math.round(averageGWA * 100) / 100,
      passingRate: Math.round(passingRate * 100) / 100,
      failingRate: Math.round(failingRate * 100) / 100,
      topPerformers: [],
      strugglingStudents: [],
      gradeDistribution: gradeRanges.map(r => ({ range: r.range, count: r.count })),
      performanceTrend: [],
    };
    
    set({ analytics });
  },

  createCourse: async (name) => {
    await supabase.from('courses').insert({ name });
    get().fetchCourses();
  },

  createSubject: async (name, courseId, teacherId) => {
    await supabase.from('subjects').insert({ 
      name, 
      course_id: courseId,
      teacher_id: teacherId || null 
    });
    get().fetchSubjects();
  },

  createStudent: async (firstName, lastName, gradeLevel, section, courseId) => {
    await supabase.from('students').insert({
      first_name: firstName,
      last_name: lastName,
      grade_level: gradeLevel,
      section,
      course_id: courseId
    });
    get().fetchStudents();
  },

  createTeacher: async (email, password, name) => {
    try {
      // Create auth user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, role: 'teacher' } }
      });
      
      if (error) return { success: false, error: error.message };
      
      if (data.user) {
        // Create user record with teacher role
        await supabase.from('users').insert({
          id: data.user.id,
          email,
          name,
          role: 'teacher',
          password_hash: 'managed_by_auth'
        });
      }
      
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  createUser: async (email, password, name, role) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, role } }
      });
      
      if (error) return { success: false, error: error.message };
      
      if (data.user) {
        await supabase.from('users').insert({
          id: data.user.id,
          email,
          name,
          role,
          password_hash: 'managed_by_auth'
        });
        
        if (role === 'student') {
          await supabase.from('students').insert({
            user_id: data.user.id,
            first_name: name.split(' ')[0],
            last_name: name.split(' ').slice(1).join(' ') || '',
            grade_level: '1',
            section: 'A'
          });
        }
      }
      
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  encodeGrade: async (studentId, subjectId, semester, quarter, grade, remarks) => {
    await supabase.from('grades').insert({
      student_id: studentId,
      subject_id: subjectId,
      semester,
      quarter,
      grade,
      remarks: remarks || null
    });
    get().fetchGrades();
  },

  updateGrade: async (gradeId, grade, remarks) => {
    await supabase.from('grades').update({ grade, remarks }).eq('id', gradeId);
    get().fetchGrades();
  },

  enrollStudentInSubject: async (studentId, subjectId) => {
    await supabase.from('student_subjects').insert({
      student_id: studentId,
      subject_id: subjectId
    });
    get().fetchStudentSubjects();
  },

  unenrollStudentFromSubject: async (studentId, subjectId) => {
    await supabase.from('student_subjects').delete()
      .eq('student_id', studentId)
      .eq('subject_id', subjectId);
    get().fetchStudentSubjects();
  },

  assignTeacherToSubject: async (subjectId, teacherId) => {
    await supabase.from('subjects').update({ teacher_id: teacherId }).eq('id', subjectId);
    get().fetchSubjects();
  },

  getTeacherSubjects: (teacherId) => {
    const { subjects } = get();
    return subjects.filter(s => s.teacher_id === teacherId);
  },

  getStudentGrades: (studentId) => {
    const { grades } = get();
    return grades.filter(g => g.student_id === studentId);
  },

  getSubjectGrades: (subjectId) => {
    const { grades } = get();
    return grades.filter(g => g.subject_id === subjectId);
  },

  calculateGWA: (studentId) => {
    const { grades } = get();
    const studentGrades = grades.filter(g => g.student_id === studentId);
    if (studentGrades.length === 0) return 0;
    
    const total = studentGrades.reduce((sum, g) => sum + Number(g.grade), 0);
    return Math.round((total / studentGrades.length) * 100) / 100;
  },
}));
