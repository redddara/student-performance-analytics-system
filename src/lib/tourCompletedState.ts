/** Per-user onboarding tour completion (localStorage). */

const TOUR_VERSION = 'v1';

export function tourCompletedStorageKey(userId: string, role: string): string {
  return `sapas_tour_completed_${TOUR_VERSION}_${userId}_${role}`;
}

export function loadTourCompleted(storageKey: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
}

export function saveTourCompleted(storageKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, '1');
  } catch {
    // ignore quota / private mode errors
  }
}
