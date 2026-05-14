import { useCallback, useEffect, useRef } from 'react';
import { supabase } from './supabase';

/** Tight debounce so burst DB writes collapse into one refetch. */
export const LIVE_RELOAD_DEBOUNCE_MS = 50;
/** Visible-tab polling so UI stays fresh even without Realtime publication. */
export const LIVE_RELOAD_POLL_MS = 2_000;

export type SupabaseLiveReloadOptions = {
  enabled?: boolean;
  debounceMs?: number;
  pollIntervalMs?: number | null;
};

/**
 * Refetches when listed public tables change (Supabase Realtime), when the tab
 * becomes visible or the window gains focus, and on a short interval while visible.
 */
export function useSupabaseLiveReload(
  reload: () => void | Promise<void>,
  channelKey: string | null,
  tables: string[],
  options?: SupabaseLiveReloadOptions
): void {
  const {
    enabled = true,
    debounceMs = LIVE_RELOAD_DEBOUNCE_MS,
    pollIntervalMs = LIVE_RELOAD_POLL_MS,
  } = options ?? {};
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const timerRef = useRef<number | null>(null);

  const runReload = useCallback(() => {
    void Promise.resolve(reloadRef.current());
  }, []);

  const scheduleReload = useCallback(() => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      runReload();
    }, debounceMs);
  }, [debounceMs, runReload]);

  const tablesKey = [...new Set(tables.filter(Boolean))].sort().join('|');

  useEffect(() => {
    if (!enabled || !channelKey || !tablesKey) return;

    const tableList = tablesKey.split('|').filter(Boolean);
    let channel = supabase.channel(channelKey);
    for (const table of tableList) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        scheduleReload();
      });
    }
    channel.subscribe();

    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [enabled, channelKey, tablesKey, scheduleReload]);

  useEffect(() => {
    if (!enabled) return;
    const onBecameActive = () => {
      if (document.visibilityState === 'visible') scheduleReload();
    };
    const onWindowFocus = () => scheduleReload();
    document.addEventListener('visibilitychange', onBecameActive);
    window.addEventListener('focus', onWindowFocus);
    return () => {
      document.removeEventListener('visibilitychange', onBecameActive);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [enabled, scheduleReload]);

  useEffect(() => {
    if (!enabled || pollIntervalMs == null || pollIntervalMs <= 0) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') runReload();
    }, pollIntervalMs);
    return () => window.clearInterval(id);
  }, [enabled, pollIntervalMs, runReload]);
}
