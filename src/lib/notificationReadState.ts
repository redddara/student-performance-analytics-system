/** Helpers for in-app notification read/unread state (localStorage). */

export function loadReadNotificationIds(storageKey: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string' && id.length > 0) : [];
  } catch {
    return [];
  }
}

export function saveReadNotificationIds(storageKey: string, ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(ids));
  } catch {
    // ignore quota / private mode errors
  }
}

export type Notifiable = { id: string };

/** Unread = in feed, has id, not in read set (deduped by id). */
export function computeUnreadNotifications<T extends Notifiable>(
  notifications: T[],
  readIds: string[]
): T[] {
  const readSet = new Set(readIds);
  const seen = new Set<string>();
  return notifications.filter((n) => {
    if (!n?.id || seen.has(n.id)) return false;
    seen.add(n.id);
    return !readSet.has(n.id);
  });
}
