export const SAPAS_INTRO_SEEN_KEY = 'sapas_intro_seen_v1';

/** Minimum time the intro plays before it can finish (ms). */
export const INTRO_MIN_DURATION_MS = 3600;

/** Extra time for the exit fade after the intro completes (ms). */
export const INTRO_EXIT_DURATION_MS = 850;

export function hasSeenIntroThisSession(): boolean {
  try {
    return sessionStorage.getItem(SAPAS_INTRO_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markIntroSeenThisSession(): void {
  try {
    sessionStorage.setItem(SAPAS_INTRO_SEEN_KEY, '1');
  } catch {
    /* ignore quota / private mode */
  }
}

export function shouldPlayIntro(): boolean {
  if (hasSeenIntroThisSession()) return false;
  if (typeof window === 'undefined') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
