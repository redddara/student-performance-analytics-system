import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Button, GlassCard, Input, MessageModal, type AppMessagePayload } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase } from '../../lib/supabase';
import { useSupabaseLiveReload } from '../../lib/useSupabaseLiveReload';

type SchoolYear = {
  id: string;
  name: string;
  is_active: boolean;
  is_archived: boolean;
};

export default function AdminAcademicPage() {
  const { user } = useAuthStore();
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [newSchoolYear, setNewSchoolYear] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [appMessage, setAppMessage] = useState<AppMessagePayload | null>(null);

  const showError = (fallback: string, err: any) =>
    setAppMessage({
      title: 'Action failed',
      message: err?.message || fallback,
      variant: 'error',
    });

  const load = useCallback(async () => {
    try {
      const [syRes, annRes] = await Promise.all([
        supabase.from('school_years').select('*').order('created_at', { ascending: false }),
        supabase.from('system_announcements').select('*').order('created_at', { ascending: false }).limit(20),
      ]);
      if (syRes.error) throw syRes.error;
      if (annRes.error) throw annRes.error;
      setSchoolYears((syRes.data || []) as SchoolYear[]);
      setAnnouncements(annRes.data || []);
    } catch (err: any) {
      showError(
        'Could not load school year or announcement data. Ensure the new migration is applied in Supabase.',
        err
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useSupabaseLiveReload(
    load,
    user?.id ? `live:admin-academic:${user.id}` : null,
    ['school_years', 'system_announcements']
  );

  const createSchoolYear = async () => {
    if (!newSchoolYear.trim()) return;
    try {
      const { error } = await supabase.from('school_years').insert({ name: newSchoolYear.trim() });
      if (error) throw error;
      setNewSchoolYear('');
      setAppMessage({ title: 'Saved', message: 'School year added.', variant: 'success' });
      await load();
    } catch (err: any) {
      showError('Could not add school year.', err);
    }
  };

  const setActiveSchoolYear = async (id: string) => {
    try {
      // Reset active rows first, then activate target row.
      const resetRes = await supabase.from('school_years').update({ is_active: false }).eq('is_active', true);
      if (resetRes.error) throw resetRes.error;
      const activeRes = await supabase
        .from('school_years')
        .update({ is_active: true, is_archived: false })
        .eq('id', id);
      if (activeRes.error) throw activeRes.error;
      setAppMessage({ title: 'Updated', message: 'Active school year changed.', variant: 'success' });
      await load();
    } catch (err: any) {
      showError('Could not set active school year.', err);
    }
  };

  const archiveSchoolYear = async (id: string) => {
    try {
      const { error } = await supabase
        .from('school_years')
        .update({ is_archived: true, is_active: false })
        .eq('id', id);
      if (error) throw error;
      setAppMessage({ title: 'Archived', message: 'School year archived.', variant: 'success' });
      await load();
    } catch (err: any) {
      showError('Could not archive school year.', err);
    }
  };

  const deleteSchoolYear = async (row: SchoolYear) => {
    if (row.is_active) {
      setAppMessage({
        title: 'Delete blocked',
        message: 'You cannot delete the active school year. Set another year as active first.',
        variant: 'warning',
      });
      return;
    }
    try {
      const { count, error: gradeCheckError } = await supabase
        .from('grades')
        .select('id', { count: 'exact', head: true })
        .eq('school_year_id', row.id);
      if (gradeCheckError) throw gradeCheckError;
      if ((count || 0) > 0) {
        setAppMessage({
          title: 'Delete blocked',
          message: 'This school year already has grade records. Archive it instead of deleting.',
          variant: 'warning',
        });
        return;
      }
      const { error } = await supabase.from('school_years').delete().eq('id', row.id);
      if (error) throw error;
      setAppMessage({ title: 'Deleted', message: 'School year removed.', variant: 'success' });
      await load();
    } catch (err: any) {
      showError('Could not delete school year.', err);
    }
  };

  const postAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementBody.trim()) return;
    try {
      const { error } = await supabase.from('system_announcements').insert({
        title: announcementTitle.trim(),
        body: announcementBody.trim(),
        is_active: true,
      });
      if (error) throw error;
      setAnnouncementTitle('');
      setAnnouncementBody('');
      setAppMessage({ title: 'Posted', message: 'Announcement is now visible to users.', variant: 'success' });
      await load();
    } catch (err: any) {
      showError('Could not post announcement.', err);
    }
  };

  const toggleAnnouncement = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase.from('system_announcements').update({ is_active: !current }).eq('id', id);
      if (error) throw error;
      await load();
    } catch (err: any) {
      showError('Could not update announcement status.', err);
    }
  };

  const deleteAnnouncement = async (id: string) => {
    try {
      const { error } = await supabase.from('system_announcements').delete().eq('id', id);
      if (error) throw error;
      setAppMessage({ title: 'Deleted', message: 'Announcement deleted.', variant: 'success' });
      await load();
    } catch (err: any) {
      showError('Could not delete announcement.', err);
    }
  };

  return (
    <DashboardLayout title="Academic Management">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GlassCard variant="plain" className="p-4 sm:p-6">
          <h2 className="mb-3 text-xl font-semibold text-[#800000]">School year / semester</h2>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <Input
              label="New school year"
              value={newSchoolYear}
              onChange={(e) => setNewSchoolYear(e.target.value)}
              placeholder="2026-2027"
            />
            <Button type="button" variant="glass" className="w-full sm:w-auto" onClick={() => void createSchoolYear()}>
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {schoolYears.map((sy) => (
              <div key={sy.id} className="flex items-center justify-between rounded-xl border border-gray-200 p-3">
                <div>
                  <p className="font-medium text-gray-900">{sy.name}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-600">
                    <span
                      className={
                        sy.is_active
                          ? 'h-2.5 w-2.5 rounded-full bg-green-500'
                          : sy.is_archived
                            ? 'h-2.5 w-2.5 rounded-full bg-amber-500'
                            : 'h-2.5 w-2.5 rounded-full bg-red-500'
                      }
                      aria-hidden
                    />
                    <span className="font-medium">
                      {sy.is_active ? 'Active' : sy.is_archived ? 'Archived' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => void setActiveSchoolYear(sy.id)}>
                    Set Active
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => void archiveSchoolYear(sy.id)}>
                    Archive
                  </Button>
                  <Button type="button" variant="danger" size="sm" onClick={() => void deleteSchoolYear(sy)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard variant="plain" className="p-4 sm:p-6">
          <h2 className="mb-3 text-xl font-semibold text-[#800000]">System announcements</h2>
          <div className="space-y-3">
            <Input
              label="Title"
              value={announcementTitle}
              onChange={(e) => setAnnouncementTitle(e.target.value)}
              placeholder="Grading period ends May 20"
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Message</label>
              <textarea
                value={announcementBody}
                onChange={(e) => setAnnouncementBody(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm"
              />
            </div>
            <Button type="button" variant="glass" className="w-full sm:w-auto" onClick={() => void postAnnouncement()}>
              Post announcement
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {announcements.map((ann) => (
              <div key={ann.id} className="rounded-xl border border-gray-200 p-3">
                <p className="font-medium text-gray-900">{ann.title}</p>
                <p className="text-sm text-gray-700">{ann.body}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void toggleAnnouncement(ann.id, ann.is_active)}
                  >
                    {ann.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => void deleteAnnouncement(ann.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
      {appMessage && (
        <MessageModal
          isOpen
          onClose={() => setAppMessage(null)}
          title={appMessage.title}
          message={appMessage.message}
          variant={appMessage.variant}
        />
      )}
    </DashboardLayout>
  );
}
