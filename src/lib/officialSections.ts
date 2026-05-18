import { supabase } from './supabase';
import { sortSelectOptions } from './sortUtils';

export type OfficialSection = {
  id: string;
  name: string;
  course_id: string | null;
  year_level: string | null;
  section_code: string | null;
  is_active: boolean;
};

export async function fetchActiveOfficialSections(): Promise<OfficialSection[]> {
  const { data, error } = await supabase
    .from('sections')
    .select('id, name, course_id, year_level, section_code, is_active')
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('Error loading official sections:', error);
    return [];
  }
  return (data || []) as OfficialSection[];
}

export function matchesOfficialSectionFilter(
  sectionId: string | null | undefined,
  filterSectionId: string
): boolean {
  if (!filterSectionId) return true;
  return (sectionId || '') === filterSectionId;
}

/** Limit dropdown to sections that appear in the current student list when possible. */
export function sectionsForStudentFilter(
  sections: OfficialSection[],
  students: { section_id?: string | null }[]
): OfficialSection[] {
  if (!students.length) return sections;
  const ids = new Set(students.map((s) => s.section_id).filter(Boolean) as string[]);
  if (!ids.size) return sections;
  const matched = sections.filter((s) => ids.has(s.id));
  return matched.length ? matched : sections;
}

export function officialSectionFilterOptions(
  sections: OfficialSection[],
  allLabel = 'All sections'
): { value: string; label: string }[] {
  return sortSelectOptions(
    [{ value: '', label: allLabel }, ...sections.map((s) => ({ value: s.id, label: s.name || '—' }))],
    ['']
  );
}

export function officialSectionDisplayName(
  student: { section_id?: string | null; section?: string | null },
  sectionsById: Map<string, OfficialSection>
): string {
  if (student.section_id) {
    const official = sectionsById.get(student.section_id);
    if (official?.name) return official.name;
  }
  return (student.section || '').trim() || '—';
}
