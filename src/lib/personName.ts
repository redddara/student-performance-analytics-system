/** Title-case each word in a person name segment (handles spaces and hyphens). */
export function formatNamePart(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';

  return trimmed
    .split(/\s+/)
    .map((word) =>
      word
        .split('-')
        .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ''))
        .join('-')
    )
    .join(' ');
}

/** Normalize first/last name fields before saving to the database. */
export function normalizePersonNames(input: {
  first_name?: string | null;
  last_name?: string | null;
}): { first_name: string; last_name: string } {
  return {
    first_name: formatNamePart(input.first_name),
    last_name: formatNamePart(input.last_name),
  };
}

/** Display name for users/students in tables, charts, and UI (title-cased). */
export function formatPersonDisplayName(input: {
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
}): string {
  if (input.name?.trim()) {
    return formatNamePart(input.name);
  }
  const { first_name, last_name } = normalizePersonNames(input);
  return `${first_name} ${last_name}`.trim();
}

export const TEACHER_NAME_TITLES = ['Mr.', 'Mrs.', 'Ms.'] as const;
export type TeacherNameTitle = (typeof TEACHER_NAME_TITLES)[number];

export const TEACHER_TITLE_SELECT_OPTIONS = [
  { value: '', label: 'Select title' },
  ...TEACHER_NAME_TITLES.map((t) => ({ value: t, label: t })),
];

/** Normalize honorific input to Mr., Mrs., Ms., or empty. */
export function normalizeTeacherTitle(value?: string | null): TeacherNameTitle | '' {
  const raw = (value ?? '').trim();
  if (!raw) return '';

  if (TEACHER_NAME_TITLES.includes(raw as TeacherNameTitle)) {
    return raw as TeacherNameTitle;
  }

  const key = raw.replace(/\./g, '').toLowerCase();
  if (key === 'mr' || key === 'mister') return 'Mr.';
  if (key === 'mrs' || key === 'missus') return 'Mrs.';
  if (key === 'ms' || key === 'miss') return 'Ms.';
  return '';
}

export function formatTeacherDisplayName(input: {
  name_title?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
}): string {
  const personName = formatPersonDisplayName(input);
  if (!personName) return '—';
  const title = normalizeTeacherTitle(input.name_title);
  return title ? `${title} ${personName}` : personName;
}

/** Official grade report: MR. LASTNAME (uses stored title when set). */
export function formatTeacherOfficialLabel(input: {
  name_title?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
}): string {
  const last = formatNamePart(input.last_name || input.name || '').toUpperCase();
  if (!last) {
    const fallback = formatNamePart(input.name || '').toUpperCase();
    return fallback || '—';
  }

  const title = normalizeTeacherTitle(input.name_title);
  const prefix =
    title === 'Mrs.'
      ? 'MRS.'
      : title === 'Ms.'
        ? 'MS.'
        : title === 'Mr.'
          ? 'MR.'
          : (() => {
              const first = formatNamePart(input.first_name || '').toLowerCase();
              return first.startsWith('maria') ? 'MRS.' : 'MR.';
            })();

  return `${prefix} ${last}`;
}
