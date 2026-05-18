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

/** 1st → 1, 2nd → 2, … for STUD-{course}-{year}{seq} IDs (e.g. STUD-CS-1001). */
export function yearLevelToStudentIdDigit(yearLevel: string): number {
  const normalized = String(yearLevel || '').trim().toLowerCase();
  if (normalized.startsWith('1')) return 1;
  if (normalized.startsWith('2')) return 2;
  if (normalized.startsWith('3')) return 3;
  if (normalized.startsWith('4')) return 4;
  return 1;
}

export function studentUsernameLikePattern(courseName: string, yearLevel: string): string {
  const courseCode = resolveStudentCourseCode(courseName);
  const yearDigit = yearLevelToStudentIdDigit(yearLevel);
  return `STUD-${courseCode}-${yearDigit}%`;
}

function parseStudentUsernameParts(username: string): {
  courseCode: string;
  yearDigit: number;
  sequence: number;
} | null {
  const parts = String(username || '')
    .trim()
    .toUpperCase()
    .split('-');
  if (parts.length !== 3 || parts[0] !== 'STUD') return null;

  const num = parts[2];
  if (!/^\d{4}$/.test(num)) return null;

  const yearDigit = parseInt(num[0], 10);
  const sequence = parseInt(num.slice(1), 10);
  if (!Number.isFinite(yearDigit) || yearDigit < 1 || yearDigit > 4) return null;
  if (!Number.isFinite(sequence) || sequence < 1) return null;

  return { courseCode: parts[1], yearDigit, sequence };
}

export function getNextStudentUsernameSequence(
  existingUsernames: Array<string | null | undefined>,
  courseName: string,
  yearLevel: string
): number {
  const courseCode = resolveStudentCourseCode(courseName);
  const yearDigit = yearLevelToStudentIdDigit(yearLevel);

  let maxSequence = 0;
  for (const raw of existingUsernames) {
    const parsed = parseStudentUsernameParts(String(raw || ''));
    if (!parsed || parsed.courseCode !== courseCode || parsed.yearDigit !== yearDigit) continue;
    if (parsed.sequence > maxSequence) maxSequence = parsed.sequence;
  }

  return maxSequence + 1;
}

/** First student in 1st year CS → STUD-CS-1001; 2nd year → STUD-CS-2001, etc. */
export function generateStudentUsername(courseName: string, yearLevel: string, sequence: number): string {
  const courseCode = resolveStudentCourseCode(courseName);
  const yearDigit = yearLevelToStudentIdDigit(yearLevel);
  const number = yearDigit * 1000 + sequence;
  return `STUD-${courseCode}-${number.toString().padStart(4, '0')}`;
}

export function createStudentUsernameAllocator(existingUsernames: Array<string | null | undefined>) {
  const maxByCourseYear = new Map<string, number>();

  for (const raw of existingUsernames) {
    const parsed = parseStudentUsernameParts(String(raw || ''));
    if (!parsed) continue;
    const key = `${parsed.courseCode}:${parsed.yearDigit}`;
    maxByCourseYear.set(key, Math.max(maxByCourseYear.get(key) || 0, parsed.sequence));
  }

  return (courseName: string, yearLevel: string) => {
    const courseCode = resolveStudentCourseCode(courseName);
    const yearDigit = yearLevelToStudentIdDigit(yearLevel);
    const key = `${courseCode}:${yearDigit}`;
    const nextSequence = (maxByCourseYear.get(key) || 0) + 1;
    maxByCourseYear.set(key, nextSequence);
    return generateStudentUsername(courseName, yearLevel, nextSequence);
  };
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
  calculateOfficialGwa,
  formatGradeDisplay,
  formatGradePoint,
  formatGwa,
  formatNumericGradePoint,
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
