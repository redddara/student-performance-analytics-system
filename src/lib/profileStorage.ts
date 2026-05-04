import type { User } from '../types';
import {
  SAPAS_USER_KEY,
  SAPAS_REMEMBER_KEY,
  SAPAS_LAST_ACTIVITY_KEY,
} from './sessionConstants';

export function isRememberMeEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(SAPAS_REMEMBER_KEY) !== 'false';
}

/** Profile JSON lives in localStorage (remember me) or sessionStorage (session-only). */
export function getProfileStorage(): Storage {
  return localStorage;
}

export function stripSensitiveUser(u: User): Omit<User, 'password_hash'> {
  const { password_hash: _p, ...rest } = u;
  return rest;
}

export function persistUserProfile(user: User): void {
  const storage = getProfileStorage();
  const other = storage === localStorage ? sessionStorage : localStorage;
  other.removeItem(SAPAS_USER_KEY);
  storage.setItem(SAPAS_USER_KEY, JSON.stringify(stripSensitiveUser(user)));
}

export function clearUserProfileEverywhere(): void {
  localStorage.removeItem(SAPAS_USER_KEY);
  sessionStorage.removeItem(SAPAS_USER_KEY);
}

/** Read profile from whichever storage has it (after remember-me switches, both may be empty). */
export function readUserProfileJson(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SAPAS_USER_KEY) ?? sessionStorage.getItem(SAPAS_USER_KEY);
}

export function touchLastActivity(): void {
  if (typeof window === 'undefined') return;
  const t = String(Date.now());
  sessionStorage.setItem(SAPAS_LAST_ACTIVITY_KEY, t);
  try {
    localStorage.setItem(SAPAS_LAST_ACTIVITY_KEY, t);
  } catch {
    /* ignore quota */
  }
}

export function readLastActivity(): number {
  if (typeof window === 'undefined') return Date.now();
  const raw =
    sessionStorage.getItem(SAPAS_LAST_ACTIVITY_KEY) ??
    localStorage.getItem(SAPAS_LAST_ACTIVITY_KEY);
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : Date.now();
}

export function clearActivityMarkers(): void {
  sessionStorage.removeItem(SAPAS_LAST_ACTIVITY_KEY);
  localStorage.removeItem(SAPAS_LAST_ACTIVITY_KEY);
}

const VOLUNTARY_LOGOUT = 'sapas_voluntary_logout';

export function markVoluntaryLogout(): void {
  sessionStorage.setItem(VOLUNTARY_LOGOUT, '1');
}

/** Returns true once (clears flag). Used to avoid showing "session expired" on intentional sign-out. */
export function consumeVoluntaryLogoutFlag(): boolean {
  const v = sessionStorage.getItem(VOLUNTARY_LOGOUT) === '1';
  sessionStorage.removeItem(VOLUNTARY_LOGOUT);
  return v;
}
