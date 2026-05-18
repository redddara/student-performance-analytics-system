/** Preset class-day patterns (Philippine-style schedules). */
export const CLASS_DAY_PRESET_OPTIONS = [
  { value: '', label: 'Every day (no fixed schedule)' },
  { value: 'MWF', label: 'Monday, Wednesday, Friday (MWF)' },
  { value: 'TTH', label: 'Tuesday, Thursday (TTh)' },
  { value: 'MTW', label: 'Monday, Tuesday, Wednesday (MTW)' },
  { value: 'MTWTHF', label: 'Monday–Friday (daily)' },
] as const;

/** Weekday picker options (JS getDay(): 0 = Sunday). */
export const WEEKDAY_PICKER_OPTIONS = [
  { value: 1, short: 'Mon', label: 'Monday' },
  { value: 2, short: 'Tue', label: 'Tuesday' },
  { value: 3, short: 'Wed', label: 'Wednesday' },
  { value: 4, short: 'Thu', label: 'Thursday' },
  { value: 5, short: 'Fri', label: 'Friday' },
  { value: 6, short: 'Sat', label: 'Saturday' },
  { value: 0, short: 'Sun', label: 'Sunday' },
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

const ENCODE_ORDER: { day: number; token: string }[] = [
  { day: 1, token: 'M' },
  { day: 2, token: 'T' },
  { day: 3, token: 'W' },
  { day: 4, token: 'TH' },
  { day: 5, token: 'F' },
  { day: 6, token: 'SA' },
  { day: 0, token: 'SU' },
];

const JS_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function parseClassDays(pattern?: string | null): Set<number> | null {
  const raw = String(pattern || '').trim().toUpperCase();
  if (!raw) return null;

  if (raw.includes(',')) {
    const days = new Set<number>();
    for (const part of raw.split(',')) {
      const token = part.trim();
      const day = TOKEN_TO_JS_DAY[token];
      if (day != null) days.add(day);
    }
    return days.size > 0 ? days : null;
  }

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

/** Encode selected weekdays into a compact pattern (e.g. Mon+Fri → MF). */
export function encodeClassDaysFromWeekdays(selected: Iterable<number>): string {
  const set = new Set(selected);
  if (set.size === 0 || set.size >= 7) return '';
  return ENCODE_ORDER.filter(({ day }) => set.has(day))
    .map(({ token }) => token)
    .join('');
}

export function classDaysToWeekdaySet(pattern?: string | null): Set<number> {
  const parsed = parseClassDays(pattern);
  if (!parsed) return new Set(WEEKDAY_PICKER_OPTIONS.map((d) => d.value));
  return parsed;
}

export function formatClassDaysLabel(pattern?: string | null): string {
  const raw = String(pattern || '').trim();
  if (!raw) return 'Every day';

  const preset = CLASS_DAY_PRESET_OPTIONS.find((p) => p.value === raw.toUpperCase());
  if (preset) return preset.label;

  const days = parseClassDays(raw);
  if (!days) return raw;

  const ordered = [1, 2, 3, 4, 5, 6, 0].filter((d) => days.has(d));
  return ordered.map((d) => JS_DAY_NAMES[d]).join(', ');
}

export type WeeklyScheduleItem = {
  subjectId: string;
  subjectName: string;
  teacherName: string;
  courseName: string;
  classDaysLabel: string;
  isBackSubject?: boolean;
  isPastTermSubject?: boolean;
};

export const WEEKLY_SCHEDULE_COLUMNS = [
  { day: 1, short: 'Mon', label: 'Monday' },
  { day: 2, short: 'Tue', label: 'Tuesday' },
  { day: 3, short: 'Wed', label: 'Wednesday' },
  { day: 4, short: 'Thu', label: 'Thursday' },
  { day: 5, short: 'Fri', label: 'Friday' },
  { day: 6, short: 'Sat', label: 'Saturday' },
  { day: 0, short: 'Sun', label: 'Sunday' },
] as const;

/** Group subjects into weekday columns; subjects without fixed days go in `daily`. */
export function partitionSubjectsByClassDays<T extends { class_days?: string | null }>(
  subjects: T[],
  toSlot: (subject: T) => WeeklyScheduleItem
): { byDay: Map<number, WeeklyScheduleItem[]>; daily: WeeklyScheduleItem[] } {
  const byDay = new Map<number, WeeklyScheduleItem[]>();
  for (const col of WEEKLY_SCHEDULE_COLUMNS) {
    byDay.set(col.day, []);
  }
  const daily: WeeklyScheduleItem[] = [];

  for (const subject of subjects) {
    const slot = toSlot(subject);
    const days = parseClassDays(subject.class_days);
    if (!days) {
      daily.push(slot);
      continue;
    }
    for (const day of days) {
      byDay.get(day)?.push(slot);
    }
  }

  const sortByName = (a: WeeklyScheduleItem, b: WeeklyScheduleItem) =>
    a.subjectName.localeCompare(b.subjectName);
  for (const list of byDay.values()) list.sort(sortByName);
  daily.sort(sortByName);

  return { byDay, daily };
}

/** True when the date falls on a scheduled class day (or no schedule is set). */
export function isScheduledClassDay(dateIso: string, pattern?: string | null): boolean {
  const days = parseClassDays(pattern);
  if (!days) return true;
  const date = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return true;
  return days.has(date.getDay());
}
