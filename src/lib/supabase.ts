import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import { SAPAS_AUTH_STORAGE_PREF_KEY } from './sessionConstants';

const rawUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

if (!rawUrl || !rawAnonKey) {
  throw new Error(
    '[SAPAS] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and set both values from Supabase → Project Settings → API.',
  );
}

/** Project URL (no trailing secrets in source — use `.env`). */
export const supabaseUrl = rawUrl;
/** Anon key from env only. */
export const supabaseAnonKey = rawAnonKey;

/** Align JWT storage with remember-me (local vs session). */
export function setAuthStoragePreference(rememberMe: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SAPAS_AUTH_STORAGE_PREF_KEY, rememberMe ? 'local' : 'local');
}

function authTargetStorage(): Storage {
  if (typeof window === 'undefined') return localStorage;
  return localStorage;
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

const STUDENT_ID_COURSE_MAP: Record<string, string> = {
  BSCS: 'CS',
  BSOA: 'OA',
  OA: 'OA',
  BTVTED: 'VTED',
  BTTE: 'VTED',
  'Bachelor of Science in Computer Science': 'CS',
  'Bachelor of Science in Office Administration': 'OA',
  'Office Administration': 'OA',
  'Bachelor of Technical-Vocational Teacher Education': 'VTED',
};

function resolveStudentCourseCode(courseName: string): string {
  const raw = courseName.trim();
  if (!raw) return 'XX';

  const lower = raw.toLowerCase();
  for (const [key, code] of Object.entries(STUDENT_ID_COURSE_MAP)) {
    if (key.toLowerCase() === lower) return code;
  }

  const u = raw.toUpperCase().replace(/\s+/g, ' ');

  // Bachelor of Technical-Vocational Teacher Education (and common variants)
  if (
    u.includes('BTVTED') ||
    u.includes('BTTE') ||
    (u.includes('TECHNICAL') && u.includes('VOCATIONAL') && (u.includes('TEACHER') || u.includes('VTED'))) ||
    (u.includes('TECH-VOC') && u.includes('TEACHER')) ||
    (u.includes('TECH VOC') && u.includes('TEACHER'))
  ) {
    return 'VTED';
  }

  // Office Administration (program or shorthand)
  if (
    u.includes('BSOA') ||
    (u.includes('OFFICE') && (u.includes('ADMIN') || u.includes('ADMINISTRATION')))
  ) {
    return 'OA';
  }

  if (u.includes('COMPUTER SCIENCE') || u === 'BSCS' || (u.includes('COMPUTER') && u.includes('SCIENCE'))) {
    return 'CS';
  }

  // Unknown program — avoid defaulting to CS (was confusing vs OA/VTED)
  return 'XX';
}

export function generateStudentUsername(courseName: string, number: number): string {
  const courseCode = resolveStudentCourseCode(courseName);
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

export {
  averagePercentToGradePoint,
  computeSubjectFinalAverage,
  calculateGWA,
  formatGradeDisplay,
  formatGradeRange,
  getGradeRemarks,
  getGradeStatus,
  getRemarkCategory,
  displayGradePercent,
  gradePointToDisplayPercent,
  gradeValueForStorage,
  isDeanListEligible,
  isPassing,
  isValidGradeInput,
  parseGradeInput,
  percentageToGradePoint,
  previewGradeInput,
  storedGradeToPercent,
  toGradePoint,
  VALID_GRADE_POINTS,
  GRADE_SCALE,
} from './gradingScale';
