import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import { SAPAS_AUTH_STORAGE_PREF_KEY } from './sessionConstants';

export const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://xlmlrplyfizfhklhaicc.supabase.co';
export const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbWxycGx5Zml6ZmhrbGhhaWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NTkxODQsImV4cCI6MjA4NzQzNTE4NH0.YOe0zHWSm5L2ltucf97doTg-mrZGwD8bMTpHe4S047Y';

/** Align JWT storage with remember-me (local vs session). */
export function setAuthStoragePreference(rememberMe: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SAPAS_AUTH_STORAGE_PREF_KEY, rememberMe ? 'local' : 'session');
}

function authTargetStorage(): Storage {
  if (typeof window === 'undefined') return localStorage;
  return localStorage.getItem(SAPAS_AUTH_STORAGE_PREF_KEY) === 'session' ? sessionStorage : localStorage;
}

const sapasAuthStorage: SupportedStorage = {
  getItem(key: string) {
    return authTargetStorage().getItem(key);
  },
  setItem(key: string, value: string) {
    const t = authTargetStorage();
    const other = t === localStorage ? sessionStorage : localStorage;
    other.removeItem(key);
    t.setItem(key, value);
  },
  removeItem(key: string) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: sapasAuthStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const getSupabaseClient = () => supabase;

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

export function generateStudentUsername(courseName: string, number: number): string {
  const courseCodeMap: Record<string, string> = {
    BSCS: 'CS',
    BSOA: 'OA',
    'Bachelor of Science in Computer Science': 'CS',
    'Bachelor of Science in Office Administration': 'OA',
  };

  const courseCode = courseCodeMap[courseName] || courseName.substring(0, 2).toUpperCase();
  return `STUD-${courseCode}-${number.toString().padStart(4, '0')}`;
}

export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export function isPassing(grade: number): boolean {
  return grade >= 75;
}

export function calculateGWA(grades: { grade: number }[]): number {
  if (grades.length === 0) return 0;
  const total = grades.reduce((sum, g) => sum + g.grade, 0);
  return Math.round((total / grades.length) * 100) / 100;
}

export function getGradeRemarks(grade: number): string {
  if (grade >= 98) return 'Excellent';
  if (grade >= 95) return 'Very Good';
  if (grade >= 90) return 'Superior';
  if (grade >= 85) return 'Very Satisfactory';
  if (grade >= 80) return 'Satisfactory';
  if (grade >= 75) return 'Passing';
  if (grade >= 70) return 'Conditional';
  return 'Failed';
}
