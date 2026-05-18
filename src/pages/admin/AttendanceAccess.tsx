import { useCallback, useEffect, useState } from 'react';
import { Check, XCircle } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Button, PageSkeletonLoader, Table } from '../../components/ui';
import { formatPersonDisplayName } from '../../lib/personName';
import { formatClassDaysLabel } from '../../lib/classSchedule';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store';
import { useSupabaseLiveReload } from '../../lib/useSupabaseLiveReload';

type AccessRow = {
  id: string;
  subject_id: string;
  attendance_date: string;
  reason: string;
  status: string;
  created_at: string;
  requested_by?: string | null;
  subject?: { name?: string; code?: string; class_days?: string | null };
};

export default function AdminAttendanceAccessPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [requesterNames, setRequesterNames] = useState<Record<string, string>>({});
  const [actionId, setActionId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const { data, error } = await supabase
      .from('attendance_access_requests')
      .select(
        'id, subject_id, attendance_date, reason, status, created_at, requested_by, subject:subjects(name, code, class_days)'
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      setRows([]);
      setLoading(false);
      return;
    }

    const list = (data as AccessRow[]) || [];
    setRows(list);

    const requesterIds = Array.from(new Set(list.map((r) => r.requested_by).filter(Boolean))) as string[];
    if (requesterIds.length) {
      const { data: users } = await supabase
        .from('users')
        .select('id, first_name, last_name, name, username')
        .in('id', requesterIds);
      const names: Record<string, string> = {};
      (users || []).forEach((u: any) => {
        names[u.id] = formatPersonDisplayName(u) || u.username || 'Teacher';
      });
      setRequesterNames(names);
    } else {
      setRequesterNames({});
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useSupabaseLiveReload(
    useCallback(async () => {
      await loadData();
    }, [loadData]),
    user?.id ? `live:admin-attendance-access:${user.id}` : null,
    ['attendance_access_requests']
  );

  const review = async (row: AccessRow, status: 'approved' | 'rejected') => {
    setActionId(row.id);
    try {
      await supabase
        .from('attendance_access_requests')
        .update({
          status,
          reviewed_by: user?.id || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      await loadData();
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Attendance access">
        <PageSkeletonLoader rows={4} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Attendance access">
      <GlassCard variant="plain" className="p-4 sm:p-6">
        <p className="mb-4 text-sm text-gray-600">
          Teachers request access when they need to enter attendance on a non-scheduled day or after a date has been
          locked. Approve to allow one edit cycle; saving attendance locks the date again.
        </p>

        {rows.length === 0 ? (
          <p className="py-10 text-center text-gray-500">No pending attendance access requests.</p>
        ) : (
          <Table variant="light" headers={['Subject', 'Date', 'Teacher', 'Schedule', 'Reason', 'Actions']}>
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50/70">
                <td className="px-4 py-3 text-gray-900">
                  <span className="font-medium">{row.subject?.name || 'Subject'}</span>
                  {row.subject?.code && (
                    <span className="ml-1 text-xs text-gray-500">({row.subject.code})</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700">{row.attendance_date}</td>
                <td className="px-4 py-3 text-gray-700">
                  {(row.requested_by && requesterNames[row.requested_by]) || 'Teacher'}
                </td>
                <td className="px-4 py-3 text-gray-700">{formatClassDaysLabel(row.subject?.class_days)}</td>
                <td className="max-w-xs px-4 py-3 text-sm text-gray-700">{row.reason}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={actionId === row.id}
                      onClick={() => void review(row, 'approved')}
                    >
                      <Check className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={actionId === row.id}
                      onClick={() => void review(row, 'rejected')}
                    >
                      <XCircle className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                      Decline
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </GlassCard>
    </DashboardLayout>
  );
}
