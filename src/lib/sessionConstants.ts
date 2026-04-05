/** Cross-tab profile payload (no password hash). */
export const SAPAS_USER_KEY = 'sapas_user';
/** Remember-me preference; always in localStorage so every tab agrees. */
export const SAPAS_REMEMBER_KEY = 'sapas_remember_me';
/** Other tabs listen for logout broadcasts. */
export const SAPAS_TAB_SYNC_KEY = 'sapas_tab_sync';
/** Last user activity (ms) for inactivity timeout. */
export const SAPAS_LAST_ACTIVITY_KEY = 'sapas_last_activity';
/** Where Supabase JWT lives: set at login to match remember-me. */
export const SAPAS_AUTH_STORAGE_PREF_KEY = 'sapas_auth_storage_pref';

export const INACTIVITY_MS = 30 * 60 * 1000;

export type TabSyncPayload = { type: 'logout'; t: number };
