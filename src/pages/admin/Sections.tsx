import { useEffect, useMemo, useState } from 'react';
import { Users, ArrowRightLeft, ArrowUpRight, Plus } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { supabase } from '../../lib/supabase';
import {
  courseSelectOptions,
  sectionSelectOptions,
  sortByName,
  sortByStudentName,
  sortSelectOptions,
} from '../../lib/sortUtils';
import {
  Button,
  GlassCard,
  Input,
  MessageModal,
  Spinner,
  Select,
  Table,
  type AppMessagePayload,
  PageSkeletonLoader,
} from '../../components/ui';

type SectionRow = {
  id: string;
  name: string;
  course_id: string | null;
  year_level: string | null;
  section_code: string | null;
  is_active: boolean;
};

type StudentRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  course_id: string | null;
  grade_level: string | null;
  section_id: string | null;
  section: string | null;
};

const YEAR_OPTIONS = [
  { value: '', label: 'All years' },
  { value: '1st', label: '1st Year' },
  { value: '2nd', label: '2nd Year' },
  { value: '3rd', label: '3rd Year' },
  { value: '4th', label: '4th Year' },
] as const;

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={
        active
          ? 'inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-800'
          : 'inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700'
      }
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export default function AdminSectionsPage() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);

  const [filterCourseId, setFilterCourseId] = useState('');
  const [filterYearLevel, setFilterYearLevel] = useState('');
  const [filterStudentSearch, setFilterStudentSearch] = useState('');
  const [filterStudentSectionId, setFilterStudentSectionId] = useState<'all' | 'unassigned' | string>('all');

  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionCourseId, setNewSectionCourseId] = useState('');
  const [newSectionYearLevel, setNewSectionYearLevel] = useState('1st');
  const [newSectionCode, setNewSectionCode] = useState('');

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const [transferToSectionId, setTransferToSectionId] = useState('');
  const [promoteToSectionId, setPromoteToSectionId] = useState('');

  const [appMessage, setAppMessage] = useState<AppMessagePayload | null>(null);
  const [creatingSection, setCreatingSection] = useState(false);
  const [assigningSection, setAssigningSection] = useState(false);
  const [promotingStudents, setPromotingStudents] = useState(false);
  const showError = (fallback: string, err: any) =>
    setAppMessage({
      title: 'Action failed',
      message: err?.message || fallback,
      variant: 'error',
    });

  const load = async () => {
    setLoading(true);
    try {
      const [courseRes, sectionRes, studentRes] = await Promise.all([
        supabase.from('courses').select('id,name').order('name', { ascending: true }),
        supabase.from('sections').select('*').order('name', { ascending: true }),
        supabase
          .from('students')
          .select('id,first_name,last_name,course_id,grade_level,section_id,section')
          .order('last_name', { ascending: true }),
      ]);
      if (courseRes.error) throw courseRes.error;
      if (sectionRes.error) throw sectionRes.error;
      if (studentRes.error) throw studentRes.error;
      setCourses(courseRes.data || []);
      setSections((sectionRes.data || []) as SectionRow[]);
      setStudents((studentRes.data || []) as StudentRow[]);
    } catch (err: any) {
      showError('Could not load section data. Ensure the sections migration is applied.', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const courseOptions = useMemo(() => courseSelectOptions(courses), [courses]);

  const filteredSections = useMemo(() => {
    const filtered = sections.filter((s) => {
      if (filterCourseId && (s.course_id || '') !== filterCourseId) return false;
      if (filterYearLevel && (s.year_level || '') !== filterYearLevel) return false;
      return true;
    });
    return sortByName(filtered);
  }, [sections, filterCourseId, filterYearLevel]);

  const sectionsById = useMemo(() => {
    const m = new Map<string, SectionRow>();
    sections.forEach((s) => m.set(s.id, s));
    return m;
  }, [sections]);

  const sectionOptions = useMemo(
    () => sectionSelectOptions(filteredSections, 'Select a section'),
    [filteredSections]
  );

  const studentsInSelectedSection = useMemo(() => {
    const term = filterStudentSearch.trim().toLowerCase();
    const filtered = students.filter((st) => {
      if (filterCourseId && (st.course_id || '') !== filterCourseId) return false;
      if (filterYearLevel && (st.grade_level || '') !== filterYearLevel) return false;
      if (filterStudentSectionId !== 'all') {
        if (filterStudentSectionId === 'unassigned') {
          if (st.section_id) return false;
        } else if ((st.section_id || '') !== filterStudentSectionId) {
          return false;
        }
      }
      if (!term) return true;
      const name = `${st.first_name || ''} ${st.last_name || ''}`.trim().toLowerCase();
      const legacy = String(st.section || '').toLowerCase();
      return name.includes(term) || legacy.includes(term);
    });
    return sortByStudentName(filtered);
  }, [students, filterCourseId, filterYearLevel, filterStudentSearch, filterStudentSectionId]);

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAllVisible = () => {
    const visibleIds = studentsInSelectedSection.map((s) => s.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedStudentIds.includes(id));
    setSelectedStudentIds((prev) => {
      if (allSelected) return prev.filter((id) => !visibleIds.includes(id));
      const merged = new Set([...prev, ...visibleIds]);
      return Array.from(merged);
    });
  };

  const createSection = async () => {
    if (!newSectionName.trim() || creatingSection) return;
    setCreatingSection(true);
    try {
      const payload: any = {
        name: newSectionName.trim(),
        course_id: newSectionCourseId || null,
        year_level: newSectionYearLevel || null,
        section_code: newSectionCode.trim() || null,
        is_active: true,
      };
      const { error } = await supabase.from('sections').insert(payload);
      if (error) throw error;
      setNewSectionName('');
      setNewSectionCode('');
      setAppMessage({ title: 'Saved', message: 'Section created.', variant: 'success' });
      await load();
    } catch (err: any) {
      showError('Could not create section.', err);
    } finally {
      setCreatingSection(false);
    }
  };

  const bulkAssign = async (sectionId: string) => {
    if (!sectionId || selectedStudentIds.length === 0 || assigningSection) return;
    setAssigningSection(true);
    try {
      const isTransfer = selectedStudentIds.some((id) => {
        const st = students.find((s) => s.id === id);
        return Boolean(st?.section_id);
      });
      const { error } = await supabase.rpc('assign_students_to_section', {
        p_student_ids: selectedStudentIds,
        p_section_id: sectionId,
        p_reason: isTransfer ? 'transfer' : 'assign',
      });
      if (error) throw error;
      setAppMessage({ title: 'Updated', message: 'Students assigned to section.', variant: 'success' });
      setSelectedStudentIds([]);
      await load();
    } catch (err: any) {
      showError('Could not assign students to section.', err);
    } finally {
      setAssigningSection(false);
    }
  };

  const promoteSelected = async () => {
    if (selectedStudentIds.length === 0 || promotingStudents) return;
    setPromotingStudents(true);
    try {
      const { data, error } = await supabase.rpc('promote_students', {
        p_student_ids: selectedStudentIds,
        p_to_section_id: promoteToSectionId || null,
      });
      if (error) throw error;
      const promotedCount = Number(data || 0);
      setAppMessage({
        title: 'Promoted',
        message: `${promotedCount} student${promotedCount === 1 ? '' : 's'} promoted successfully.`,
        variant: 'success',
      });
      setSelectedStudentIds([]);
      await load();
    } catch (err: any) {
      showError('Could not promote selected students.', err);
    } finally {
      setPromotingStudents(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Sections & Year Levels">
        <PageSkeletonLoader rows={6} />
      </DashboardLayout>
    );
  }

  const visibleIds = studentsInSelectedSection.map((s) => s.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedStudentIds.includes(id));

  return (
    <DashboardLayout title="Sections & Year Levels">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GlassCard variant="plain" className="p-4 sm:p-6">
          <h2 className="mb-3 text-xl font-semibold text-[#800000]">Official sections</h2>
          <div className="mb-5 space-y-3">
            <Input
              label="Section name"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              placeholder="BSCS 1-A"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Select
                label="Course"
                value={newSectionCourseId}
                onChange={(e) => setNewSectionCourseId(e.target.value)}
                options={sortSelectOptions(
                  [{ value: '', label: 'Unlinked' }, ...courses.map((c) => ({ value: c.id, label: c.name || '' }))],
                  ['']
                )}
              />
              <Select
                label="Year level"
                value={newSectionYearLevel}
                onChange={(e) => setNewSectionYearLevel(e.target.value)}
                options={YEAR_OPTIONS.filter((o) => o.value !== '') as any}
              />
              <Input
                label="Code (optional)"
                value={newSectionCode}
                onChange={(e) => setNewSectionCode(e.target.value)}
                placeholder="A"
              />
            </div>
            <Button
              type="button"
              variant="glass"
              className="w-full sm:w-auto"
              onClick={() => void createSection()}
              disabled={creatingSection}
            >
              {creatingSection ? <Spinner size="sm" /> : <Plus className="h-5 w-5 shrink-0" />}
              {creatingSection ? 'Creating…' : 'Create section'}
            </Button>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Filter course"
              value={filterCourseId}
              onChange={(e) => setFilterCourseId(e.target.value)}
              options={courseOptions}
            />
            <Select
              label="Filter year level"
              value={filterYearLevel}
              onChange={(e) => setFilterYearLevel(e.target.value)}
              options={YEAR_OPTIONS as any}
            />
          </div>

          <Table variant="light" headers={['Section', 'Course', 'Year', 'Status']}>
            {filteredSections.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-semibold text-[#800000]">{s.name}</td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {courses.find((c) => c.id === s.course_id)?.name || '—'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{s.year_level || '—'}</td>
                <td className="px-4 py-3">
                  <StatusPill active={s.is_active} />
                </td>
              </tr>
            ))}
          </Table>
        </GlassCard>

        <GlassCard variant="plain" className="p-4 sm:p-6">
          <h2 className="mb-3 text-xl font-semibold text-[#800000]">Student assignment & promotion</h2>

          <div className="mb-4 grid grid-cols-1 gap-3">
            <Input
              label="Search students"
              value={filterStudentSearch}
              onChange={(e) => setFilterStudentSearch(e.target.value)}
              placeholder="Search name or legacy section..."
            />
            <Select
              label="Filter by current official section"
              value={filterStudentSectionId}
              onChange={(e) => setFilterStudentSectionId(e.target.value as any)}
              options={[
                { value: 'all', label: 'All students' },
                { value: 'unassigned', label: 'Unassigned (no official section)' },
                ...filteredSections.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={toggleAllVisible}>
              <Users className="h-5 w-5 shrink-0" />
              {allVisibleSelected ? 'Unselect visible' : 'Select visible'}
            </Button>
            <p className="text-sm text-gray-600">
              Selected: <span className="font-semibold text-[#800000]">{selectedStudentIds.length}</span>
            </p>
          </div>

          <div className="space-y-4">
            <Table variant="light" headers={['', 'Student', 'Year', 'Official section', 'Legacy']}>
              {studentsInSelectedSection.map((st) => {
                const checked = selectedStudentIds.includes(st.id);
                const name = `${st.first_name || ''} ${st.last_name || ''}`.trim() || 'Unnamed student';
                const official = st.section_id ? sectionsById.get(st.section_id)?.name || '—' : '—';
                return (
                  <tr key={st.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleStudent(st.id)}
                        aria-label={`Select ${name}`}
                        className="h-4 w-4 accent-[#800000]"
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-900">{name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{st.grade_level || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{official}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{st.section || '—'}</td>
                  </tr>
                );
              })}
            </Table>
            {studentsInSelectedSection.length === 0 && (
              <p className="text-sm text-gray-600">No students match the current filters.</p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassCard variant="plain" className="p-4">
                <h3 className="mb-2 text-base font-semibold text-[#800000]">Assign / transfer</h3>
                <Select
                  label="Assign to"
                  value={transferToSectionId}
                  onChange={(e) => setTransferToSectionId(e.target.value)}
                  options={sectionOptions}
                />
                <Button
                  type="button"
                  className="mt-3 w-full sm:w-auto"
                  variant="glass"
                  disabled={!transferToSectionId || selectedStudentIds.length === 0 || assigningSection}
                  onClick={() => void bulkAssign(transferToSectionId)}
                >
                  {assigningSection ? <Spinner size="sm" /> : <ArrowRightLeft className="h-5 w-5 shrink-0" />}
                  {assigningSection ? 'Applying…' : 'Apply section'}
                </Button>
              </GlassCard>

              <GlassCard variant="plain" className="p-4">
                <h3 className="mb-2 text-base font-semibold text-[#800000]">Promote year level</h3>
                <Select
                  label="Assign after promotion (optional)"
                  value={promoteToSectionId}
                  onChange={(e) => setPromoteToSectionId(e.target.value)}
                  options={[{ value: '', label: 'Keep current section assignment' }, ...sectionOptions.slice(1)]}
                />
                <Button
                  type="button"
                  className="mt-3 w-full sm:w-auto"
                  variant="glass"
                  disabled={selectedStudentIds.length === 0 || promotingStudents}
                  onClick={() => void promoteSelected()}
                >
                  {promotingStudents ? <Spinner size="sm" /> : <ArrowUpRight className="h-5 w-5 shrink-0" />}
                  {promotingStudents ? 'Promoting…' : 'Promote students'}
                </Button>
                <p className="mt-2 text-xs text-gray-600">1st→2nd→3rd→4th (4th stays 4th).</p>
              </GlassCard>
            </div>
          </div>
        </GlassCard>
      </div>

      {appMessage && (
        <MessageModal isOpen onClose={() => setAppMessage(null)} title={appMessage.title} message={appMessage.message} variant={appMessage.variant} />
      )}
    </DashboardLayout>
  );
}
