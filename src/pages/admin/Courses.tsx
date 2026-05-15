import { useState, useEffect } from 'react';
import { Download, Pencil, Plus, Trash2, Upload, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageIntro } from '../../components/layouts/PageIntro';
import {
  GlassCard,
  Button,
  Input,
  Table,
  Modal,
  Spinner,
  PageSkeletonLoader,
  ConfirmModal,
  MessageModal,
  type AppMessagePayload,
} from '../../components/ui';
import { useDataStore } from '../../store';
import { supabase } from '../../lib/supabase';

export default function AdminCoursesPage() {
  const { courses, setCourses } = useDataStore();
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [courseName, setCourseName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean; id: string | null; name: string | null}>({ isOpen: false, id: null, name: null });
  const [appMessage, setAppMessage] = useState<AppMessagePayload | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    const { data } = await supabase.from('courses').select('*').order('name');
    setCourses(data || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (editingCourse) {
        const { error } = await supabase.from('courses').update({ name: courseName }).eq('id', editingCourse.id);
        if (error) throw error;
        setAppMessage({ title: 'Course updated', message: `"${courseName}" has been saved.`, variant: 'success' });
      } else {
        const { error } = await supabase.from('courses').insert({ name: courseName });
        if (error) throw error;
        setAppMessage({ title: 'Course added', message: `"${courseName}" is now available for subjects and students.`, variant: 'success' });
      }

      setShowModal(false);
      setCourseName('');
      setEditingCourse(null);
      loadCourses();
    } catch (err: any) {
      setAppMessage({
        title: 'Could not save course',
        message: err.message || 'Check your connection and try again.',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (course: any) => {
    setEditingCourse(course);
    setCourseName(course.name);
    setShowModal(true);
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteConfirm({ isOpen: true, id, name });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.id || deleting) return;
    setDeleting(true);
    const name = deleteConfirm.name || 'Course';
    try {
      const { error } = await supabase.from('courses').delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      setAppMessage({ title: 'Course deleted', message: `"${name}" has been removed.`, variant: 'success' });
      loadCourses();
    } catch (err: any) {
      setAppMessage({
        title: 'Could not delete course',
        message: err.message || 'It may still be linked to subjects or students.',
        variant: 'error',
      });
    } finally {
      setDeleting(false);
      setDeleteConfirm({ isOpen: false, id: null, name: null });
    }
  };

  if (loading) {
    return <DashboardLayout title="Courses"><PageSkeletonLoader rows={4} /></DashboardLayout>;
  }

  return (
    <DashboardLayout title="Course Management">
      <PageIntro
        title="Programs & courses"
      />
      <div className="mb-6 flex flex-wrap gap-3">
        <Button type="button" variant="glass" onClick={() => setShowModal(true)} className="w-full sm:w-auto">
          <Plus className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          Add Course
        </Button>
        <Button type="button" variant="secondary" onClick={() => setShowBulkModal(true)} className="w-full sm:w-auto">
          <Upload className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          Bulk Add Courses
        </Button>
      </div>
      
      <GlassCard className="p-4 sm:p-6">
        <Table headers={['Course Name', 'Actions']}>
          {courses.map(course => (
            <tr key={course.id} className="hover:bg-white/20">
              <td className="px-4 py-3 font-medium text-gray-800">{course.name}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="p-2 rounded-lg glass-hover text-[#800000]"
                    onClick={() => handleEdit(course)}
                    aria-label={`Edit ${course.name}`}
                    title={`Edit ${course.name}`}
                  >
                    <Pencil className="h-[1.15rem] w-[1.15rem] shrink-0" strokeWidth={2} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="p-2 rounded-lg glass-hover text-red-600"
                    onClick={() => handleDelete(course.id, course.name)}
                    aria-label={`Delete ${course.name}`}
                    title={`Delete ${course.name}`}
                  >
                    <Trash2 className="h-[1.15rem] w-[1.15rem] shrink-0" strokeWidth={2} aria-hidden />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
        {courses.length === 0 && <p className="text-center text-gray-500 py-8">No courses yet</p>}
      </GlassCard>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setCourseName(''); setEditingCourse(null); }} title={editingCourse ? 'Edit Course' : 'Add Course'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Course Name" value={courseName} onChange={e => setCourseName(e.target.value)} placeholder="e.g., BSCS" required />
          <div className="flex gap-4">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowModal(false);
                setCourseName('');
                setEditingCourse(null);
              }}
            >
              <XCircle className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? (
                <Spinner size="sm" />
              ) : editingCourse ? (
                <Pencil className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              ) : (
                <Plus className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              )}
              {submitting ? 'Saving...' : editingCourse ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null, name: null })}
        onConfirm={confirmDelete}
        title="Delete Course"
        message={`Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />

      {appMessage && (
        <MessageModal
          isOpen
          onClose={() => setAppMessage(null)}
          title={appMessage.title}
          message={appMessage.message}
          variant={appMessage.variant}
        />
      )}

      <Modal isOpen={showBulkModal} onClose={() => { setShowBulkModal(false); setBulkResults(null); }} title="Bulk Add Courses" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Upload CSV/XLSX with column <code>name</code> (one course per row).
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const ws = XLSX.utils.json_to_sheet([{ name: 'BSCS' }, { name: 'BSOA' }]);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Courses');
                XLSX.writeFile(wb, 'bulk_courses_template.xlsx');
              }}
            >
              <Download className="h-5 w-5 shrink-0" />
              Download template
            </Button>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={bulkLoading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBulkLoading(true);
                setBulkResults(null);
                try {
                  const buffer = await file.arrayBuffer();
                  const wb = XLSX.read(buffer);
                  const rows = XLSX.utils.sheet_to_json<{ name?: string }>(wb.Sheets[wb.SheetNames[0]]);
                  const existing = new Set(courses.map((c) => String(c.name || '').trim().toLowerCase()));
                  let success = 0;
                  let failed = 0;
                  const errors: string[] = [];
                  for (let i = 0; i < rows.length; i++) {
                    const name = String(rows[i].name || '').trim();
                    if (!name) {
                      failed += 1;
                      errors.push(`Row ${i + 2}: name is required.`);
                      continue;
                    }
                    const key = name.toLowerCase();
                    if (existing.has(key)) {
                      failed += 1;
                      errors.push(`Row ${i + 2}: "${name}" already exists.`);
                      continue;
                    }
                    const { error } = await supabase.from('courses').insert({ name });
                    if (error) {
                      failed += 1;
                      errors.push(`Row ${i + 2}: ${error.message}`);
                      continue;
                    }
                    existing.add(key);
                    success += 1;
                  }
                  setBulkResults({ success, failed, errors: errors.slice(0, 12) });
                  setAppMessage({
                    title: 'Bulk import finished',
                    message: `Created ${success} course(s). Failed: ${failed}.`,
                    variant: failed > 0 ? 'warning' : 'success',
                  });
                  loadCourses();
                } finally {
                  setBulkLoading(false);
                  e.target.value = '';
                }
              }}
              className="w-full min-w-0 text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-[#800000] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
          </div>
          {bulkLoading && <Spinner size="sm" />}
          {bulkResults && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-center">
                <p className="text-xl font-bold text-green-700">{bulkResults.success}</p>
                <p className="text-sm text-green-800">Created</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center">
                <p className="text-xl font-bold text-red-700">{bulkResults.failed}</p>
                <p className="text-sm text-red-800">Failed</p>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </DashboardLayout>
  );
}

