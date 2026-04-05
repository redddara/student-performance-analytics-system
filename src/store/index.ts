import { create } from 'zustand';
import type { User, Course, Subject, Student, Grade, StudentSubject } from '../types';
import { supabase } from '../lib/supabase';
import {
  clearUserProfileEverywhere,
  markVoluntaryLogout,
  persistUserProfile,
} from '../lib/profileStorage';
import { SAPAS_TAB_SYNC_KEY } from '../lib/sessionConstants';
import type { TabSyncPayload } from '../lib/sessionConstants';

function toSessionUser(user: User): User {
  return { ...user, password_hash: '' };
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: (options?: { voluntary?: boolean }) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => {
    if (user) {
      persistUserProfile(user);
      set({ user: toSessionUser(user) });
      return;
    }
    clearUserProfileEverywhere();
    set({ user: null });
  },
  setLoading: (isLoading) => set({ isLoading }),
  logout: async (options) => {
    if (options?.voluntary) {
      markVoluntaryLogout();
    }
    try {
      await supabase.auth.signOut();
    } catch {
      /* still clear local session */
    }
    clearUserProfileEverywhere();
    try {
      const payload: TabSyncPayload = { type: 'logout', t: Date.now() };
      localStorage.setItem(SAPAS_TAB_SYNC_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
    set({ user: null });
  },
}));

interface DataState {
  courses: Course[];
  subjects: Subject[];
  students: Student[];
  teachers: User[];
  grades: Grade[];
  studentSubjects: StudentSubject[];
  isLoading: boolean;
  setCourses: (courses: Course[]) => void;
  setSubjects: (subjects: Subject[]) => void;
  setStudents: (students: Student[]) => void;
  setTeachers: (teachers: User[]) => void;
  setGrades: (grades: Grade[]) => void;
  setStudentSubjects: (studentSubjects: StudentSubject[]) => void;
  setLoading: (loading: boolean) => void;
  addCourse: (course: Course) => void;
  addSubject: (subject: Subject) => void;
  addStudent: (student: Student) => void;
  addTeacher: (teacher: User) => void;
  addGrade: (grade: Grade) => void;
  updateGrade: (gradeId: string, data: Partial<Grade>) => void;
  addStudentSubject: (studentSubject: StudentSubject) => void;
}

export const useDataStore = create<DataState>((set) => ({
  courses: [],
  subjects: [],
  students: [],
  teachers: [],
  grades: [],
  studentSubjects: [],
  isLoading: false,
  setCourses: (courses) => set({ courses }),
  setSubjects: (subjects) => set({ subjects }),
  setStudents: (students) => set({ students }),
  setTeachers: (teachers) => set({ teachers }),
  setGrades: (grades) => set({ grades }),
  setStudentSubjects: (studentSubjects) => set({ studentSubjects }),
  setLoading: (isLoading) => set({ isLoading }),
  addCourse: (course) => set((state) => ({ courses: [...state.courses, course] })),
  addSubject: (subject) => set((state) => ({ subjects: [...state.subjects, subject] })),
  addStudent: (student) => set((state) => ({ students: [...state.students, student] })),
  addTeacher: (teacher) => set((state) => ({ teachers: [...state.teachers, teacher] })),
  addGrade: (grade) => set((state) => ({ grades: [...state.grades, grade] })),
  updateGrade: (gradeId, data) => set((state) => ({
    grades: state.grades.map(g => g.id === gradeId ? { ...g, ...data } : g)
  })),
  addStudentSubject: (studentSubject) => set((state) => ({ 
    studentSubjects: [...state.studentSubjects, studentSubject] 
  })),
}));

interface UIState {
  sidebarOpen: boolean;
  activeTab: string;
  setSidebarOpen: (open: boolean) => void;
  setActiveTab: (tab: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  activeTab: 'dashboard',
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setActiveTab: (activeTab) => set({ activeTab }),
}));