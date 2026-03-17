export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'teacher' | 'student';
  created_at: string;
}

export interface Course {
  id: string;
  name: string;
  created_at: string;
}

export interface Subject {
  id: string;
  name: string;
  course_id: string;
  course?: Course;
  teacher_id: string | null;
  teacher?: User;
  created_at: string;
}

export interface Student {
  id: string;
  first_name: string;
  last_name: string;
  grade_level: string;
  section: string | null;
  course_id: string | null;
  user_id: string | null;
  user?: User;
  course?: Course;
  created_at: string;
}

export interface Grade {
  id: string;
  student_id: string;
  subject_id: string;
  semester: number;
  quarter: number;
  grade: number;
  remarks: string | null;
  created_at: string;
  student?: Student;
  subject?: Subject;
}

export interface StudentSubject {
  id: string;
  student_id: string;
  subject_id: string;
  created_at: string;
  student?: Student;
  subject?: Subject;
}

export interface AnalyticsData {
  totalStudents: number;
  totalTeachers: number;
  totalCourses: number;
  totalSubjects: number;
  averageGWA: number;
  passingRate: number;
  failingRate: number;
  topPerformers: Student[];
  strugglingStudents: Student[];
  gradeDistribution: { range: string; count: number }[];
  performanceTrend: { month: string; avgGrade: number }[];
}

export interface FilterOptions {
  courseId?: string;
  subjectId?: string;
  studentId?: string;
  semester?: number;
  quarter?: number;
  dateRange?: {
    start: string;
    end: string;
  };
}
