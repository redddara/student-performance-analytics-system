import { useSupabaseLiveReload, type SupabaseLiveReloadOptions } from './useSupabaseLiveReload';

export { useSupabaseLiveReload, LIVE_RELOAD_DEBOUNCE_MS, LIVE_RELOAD_POLL_MS } from './useSupabaseLiveReload';
export type { SupabaseLiveReloadOptions } from './useSupabaseLiveReload';

/** Tables that typically affect shared grade views (student + teacher). */
const GRADES_LIVE_TABLES = ['grades', 'student_subjects', 'school_years', 'subjects', 'students'] as const;

/** @deprecated Prefer `useSupabaseLiveReload` with an explicit table list for each page. */
export function useGradesAutoRefresh(
  reload: () => void | Promise<void>,
  channelKey: string | null,
  options?: SupabaseLiveReloadOptions
): void {
  useSupabaseLiveReload(reload, channelKey, [...GRADES_LIVE_TABLES], options);
}
