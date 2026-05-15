import { sortByLabel } from '../lib/sortUtils';

/** Section codes shown in UI as shortcuts only (e.g. 1m1, 2n2). */
export const SCHOOL_SECTION_CODES = [
  '1m1',
  '1m2',
  '1n1',
  '1n2',
  '2m1',
  '2m2',
  '2n1',
  '2n2',
  '3m1',
  '3m2',
  '3n1',
  '3n2',
  '4m1',
  '4m2',
  '4n1',
  '4n2',
] as const;

export type SchoolSectionCode = (typeof SCHOOL_SECTION_CODES)[number];

export const DEFAULT_SCHOOL_SECTION: SchoolSectionCode = '1m1';

export const SCHOOL_SECTION_IS_VALID = new Set<string>(SCHOOL_SECTION_CODES);

export const SCHOOL_SECTION_SELECT_OPTIONS: { value: string; label: string }[] = sortByLabel(
  SCHOOL_SECTION_CODES.map((code) => ({ value: code, label: code }))
);

export function normalizeSchoolSection(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/** Map DB value to a valid dropdown code, or keep legacy text for the select list. */
export function sectionFromUserRecord(section: string | null | undefined): string {
  const raw = (section ?? '').trim();
  if (!raw) return DEFAULT_SCHOOL_SECTION;
  const n = normalizeSchoolSection(raw);
  if (SCHOOL_SECTION_IS_VALID.has(n)) return n;
  return raw;
}
