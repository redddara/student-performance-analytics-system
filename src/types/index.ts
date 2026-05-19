export type UserRole = 'admin' | 'teacher' | 'student';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  name?: string;
  first_name?: string;
  last_name?: string;
  /** Teacher honorific: Mr., Mrs., or Ms. */
  name_title?: string | null;
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
  /** When true for students, account access is disabled (dropout). */
  is_dropout?: boolean;
}

export interface Course {
  id: string;
  name: string;
  created_at?: string;
}

export interface Subject {
  id: string;
  name: string;
  code?: string;
  course_id: string;
  teacher_id?: string;
  year_level?: string;
  semester?: string;
  created_at?: string;
  course?: Course;
  teacher?: User;
}

export type StudentStatus = 'active' | 'inactive' | 'graduated' | 'transferred';

export interface Student {
  id: string;
  first_name: string;
  last_name: string;
  grade_level: string;
  /** 1 = 1st semester, 2 = 2nd semester (current term for this year level). */
  current_semester?: number;
  section?: string;
  course_id?: string;
  user_id?: string;
  /** Enrollment status: active students appear in grade encoding. */
  student_status?: StudentStatus;
  created_at?: string;
  user?: User;
  course?: Course;
}

export interface SubjectPrerequisite {
  id?: string;
  subject_id: string;
  prerequisite_subject_id: string;
  minimum_grade?: number;
}

export interface Grade {
  id: string;
  student_id: string;
  subject_id: string;
  semester: number;
  quarter: number;
  grade: number;
  remarks?: string;
  grade_status?: 'passed' | 'failed' | 'inc';
  created_at?: string;
  student?: Student;
  subject?: Subject;
}

export type GradeDisputeStatus = 'pending' | 'accepted' | 'rejected';

export interface GradeDispute {
  id: string;
  grade_id: string;
  student_id: string;
  teacher_id?: string | null;
  reason: string;
  status: GradeDisputeStatus;
  teacher_response?: string | null;
  disputed_grade?: number | null;
  corrected_grade?: number | null;
  resolved_at?: string | null;
  resolution_seen_at?: string | null;
  created_at?: string;
  updated_at?: string;
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

export { GRADING_PERIODS, QUARTERS } from '../lib/gradingPeriods';

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