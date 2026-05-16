import { formatPersonDisplayName } from './personName';

const TEXT_COLLATOR = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** Alphabetical with embedded numbers in order (e.g. BSCS-3N1 before BSCS-4N1). */
export function compareAlphabetical(a: string, b: string): number {
  return TEXT_COLLATOR.compare(a || '', b || '');
}

/** Low to high for numeric values. */
export function compareNumeric(a: number, b: number): number {
  return a - b;
}

export function sortStrings(items: string[]): string[] {
  return [...items].sort(compareAlphabetical);
}

export function sortByLabel<T extends { label: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => compareAlphabetical(a.label, b.label));
}

export function sortByName<T extends { name?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => compareAlphabetical(a.name || '', b.name || ''));
}

export function sortByStudentName<
  T extends { first_name?: string | null; last_name?: string | null; name?: string | null },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const na = formatPersonDisplayName(a);
    const nb = formatPersonDisplayName(b);
    return compareAlphabetical(na, nb);
  });
}

export function sortSelectOptions<T extends { value: string; label: string }>(
  items: T[],
  pinnedFirst?: string[]
): T[] {
  const pinned = new Set(pinnedFirst ?? []);
  const head = (pinnedFirst ?? [])
    .map((value) => items.find((o) => o.value === value))
    .filter(Boolean) as T[];
  const rest = items.filter((o) => !pinned.has(o.value));
  return [...head, ...sortByLabel(rest)];
}

export function courseSelectOptions(
  courses: { id: string; name?: string | null }[],
  allLabel = 'All courses'
): { value: string; label: string }[] {
  return sortSelectOptions(
    [{ value: '', label: allLabel }, ...courses.map((c) => ({ value: c.id, label: c.name || '' }))],
    ['']
  );
}

export function subjectSelectOptions(
  subjects: { id: string; name?: string | null }[],
  allLabel = 'All subjects'
): { value: string; label: string }[] {
  return sortSelectOptions(
    [{ value: '', label: allLabel }, ...subjects.map((s) => ({ value: s.id, label: s.name || '' }))],
    ['']
  );
}

export function sectionSelectOptions(
  sections: { id: string; name?: string | null }[],
  placeholderLabel = 'Select a section'
): { value: string; label: string }[] {
  return sortSelectOptions(
    [{ value: '', label: placeholderLabel }, ...sections.map((s) => ({ value: s.id, label: s.name || '' }))],
    ['']
  );
}
