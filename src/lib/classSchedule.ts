/** Preset class-day patterns (Philippine-style schedules). */
export const CLASS_DAY_PRESET_OPTIONS = [
  { value: '', label: 'Every day (no fixed schedule)' },
  { value: 'MWF', label: 'Monday, Wednesday, Friday (MWF)' },
  { value: 'TTH', label: 'Tuesday, Thursday (TTh)' },
  { value: 'MTW', label: 'Monday, Tuesday, Wednesday (MTW)' },
  { value: 'MTWTHF', label: 'Monday–Friday (daily)' },
] as const;

const TOKEN_TO_JS_DAY: Record<string, number> = {
  SU: 0,
  SUN: 0,
  M: 1,
  MON: 1,
  T: 2,
  TUE: 2,
  W: 3,
  WED: 3,
  TH: 4,
  THU: 4,
  F: 5,
  FRI: 5,
  SA: 6,
  SAT: 6,
};

const ORDERED_TOKENS = ['TH', 'SUN', 'MON', 'TUE', 'WED', 'SAT', 'SA', 'SU', 'M', 'T', 'W', 'F'] as const;

export function parseClassDays(pattern?: string | null): Set<number> | null {
  const raw = String(pattern || '').trim().toUpperCase();
  if (!raw) return null;

  const days = new Set<number>();
  let i = 0;
  while (i < raw.length) {
    let matched = false;
    for (const token of ORDERED_TOKENS) {
      if (raw.startsWith(token, i)) {
        const day = TOKEN_TO_JS_DAY[token];
        if (day != null) days.add(day);
        i += token.length;
        matched = true;
        break;
      }
    }
    if (!matched) i += 1;
  }

  return days.size > 0 ? days : null;
}

export function formatClassDaysLabel(pattern?: string | null): string {
  const raw = String(pattern || '').trim();
  if (!raw) return 'Every day';
  const preset = CLASS_DAY_PRESET_OPTIONS.find((p) => p.value === raw.toUpperCase());
  return preset?.label ?? raw;
}

/** True when the date falls on a scheduled class day (or no schedule is set). */
export function isScheduledClassDay(dateIso: string, pattern?: string | null): boolean {
  const days = parseClassDays(pattern);
  if (!days) return true;
  const date = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return true;
  return days.has(date.getDay());
}
