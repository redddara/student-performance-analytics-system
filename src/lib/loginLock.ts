import type { User } from '../types';

export const LOGIN_MAX_ATTEMPTS = 3;
export const LOGIN_LOCK_MINUTES = 30;

export function isLoginLocked(user: Pick<User, 'login_locked_until'> | { login_locked_until?: string | null }): boolean {
  if (!user?.login_locked_until) return false;
  return new Date(user.login_locked_until).getTime() > Date.now();
}

export function formatLockUntil(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}
