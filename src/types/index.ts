export type UserRole = 'admin' | 'teacher' | 'student';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  name?: string;
  first_name?: string;
  last_name?: string;
  year_level?: string;
  section?: string;
  course_id?: string;
  username?: string;
  is_temp_password: boolean;
  temp_password_visible?: string;
  created_at?: string;
  /** Failed password attempts (server-side when RPC migration is applied). */
  login_failed_attempts?: number;
  /** If set and in the future, login is blocked until this time or admin unlock. */
  login_locked_until?: string | null;
}

export interface Course {
  id: string;
  name: string;
  created_at?: string;
}

export interface Subject {
  id: string;
  name: string;
  course_id: string;
  teacher_id?: string;
  year_level?: string;
  semester?: string;
  created_at?: string;
  course?: Course;
  teacher?: User;
}

export interface Student {
  id: string;
  first_name: string;
  last_name: string;
  grade_level: string;
  section?: string;
  course_id?: string;
  user_id?: string;
  created_at?: string;
  user?: User;
  course?: Course;
}

export interface Grade {
  id: string;
  student_id: string;
  subject_id: string;
  semester: number;
  quarter: number;
  grade: number;
  remarks?: string;
  created_at?: string;
  student?: Student;
  subject?: Subject;
}

export interface StudentSubject {
  id: string;
  student_id: string;
  subject_id: string;
  created_at?: string;
  student?: Student;
  subject?: Subject;
}

export interface GradeWithDetails extends Grade {
  student_name?: string;
  subject_name?: string;
  course_name?: string;
}

export interface StudentGradeSummary {
  student_id: string;
  student_name: string;
  course_name: string;
  subject_id: string;
  subject_name: string;
  semester: number;
  grades: {
    quarter: number;
    grade: number;
    remarks?: string;
  }[];
  average?: number;
}

export interface SubjectStats {
  subject_id: string;
  subject_name: string;
  total_students: number;
  passing: number;
  failing: number;
  average_grade: number;
  grade_distribution: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
}

export interface StudentAnalytics {
  student_id: string;
  student_name: string;
  gwa: number;
  total_subjects: number;
  passing_subjects: number;
  failing_subjects: number;
  subjects: StudentGradeSummary[];
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  quarterly_trends: {
    quarter: number;
    average: number;
  }[];
}

export const QUARTERS = [
  { value: 1, label: 'Prelim' },
  { value: 2, label: 'Midterm' },
  { value: 3, label: 'Pre-Finals' },
  { value: 4, label: 'Finals' },
] as const;

export const SEMESTERS = [
  { value: 1, label: '1st Semester' },
  { value: 2, label: '2nd Semester' },
] as const;

export const YEAR_LEVELS = [
  { value: '1st', label: '1st Year' },
  { value: '2nd', label: '2nd Year' },
  { value: '3rd', label: '3rd Year' },
  { value: '4th', label: '4th Year' },
] as const;

export const COURSE_CODES: Record<string, string> = {
  'Bachelor of Science in Computer Science': 'CS',
  'Bachelor of Science in Office Administration': 'OA',
  'BSCS': 'CS',
  'BSOA': 'OA',
};