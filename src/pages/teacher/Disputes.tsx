import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, MessageSquareWarning, XCircle } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import {
  Badge,
  Button,
  GlassCard,
  MessageModal,
  PageSkeletonLoader,
  Select,
  type AppMessagePayload,
} from '../../components/ui';
import { useAuthStore } from '../../store';
import {
  acceptGradeDispute,
  buildDisputeSummaryLine,
  disputeStatusBadgeVariant,
  disputeStatusLabel,
  fetchTeacherDisputes,
  formatDisputedGradeDisplay,
  rejectGradeDispute,
  type GradeDisputeWithDetails,
} from '../../lib/gradeDisputes';
import { formatPersonDisplayName } from '../../lib/personName';
import { getGradeRemarks, getGradeStatus, gradeValueForStorage } from '../../lib/supabase';
import { useSupabaseLiveReload } from '../../lib/useSupabaseLiveReload';

export default function TeacherDisputesPage() {
  const { user } = useAuthStore();
  const [disputes, setDisputes] = useState<GradeDisputeWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'all' | 'accepted' | 'rejected'>('pending');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<GradeDisputeWithDetails | null>(null);
  const [rejectTarget, setRejectTarget] = useState<GradeDisputeWithDetails | null>(null);
  const [correctedGradeInput, setCorrectedGradeInput] = useState('');
  const [teacherResponse, setTeacherResponse] = useState('');
  const [appMessage, setAppMessage] = useState<AppMessagePayload | null>(null);

  const loadDisputes = useCallback(async () => {
    if (!user?.id) return;
    try {
      const list = await fetchTeacherDisputes(user.id);
      setDisputes(list);
    } catch (err) {
      console.error(err);
      setDisputes([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadDisputes();
  }, [loadDisputes]);

  useSupabaseLiveReload(
    loadDisputes,
    user?.id ? `live:teacher-disputes:${user.id}` : null,
    ['grade_disputes', 'grades'],
  );

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return disputes;
    return disputes.filter((d) => d.status === statusFilter);
  }, [disputes, statusFilter]);

  const pendingCount = useMemo(() => disputes.filter((d) => d.status === 'pending').length, [disputes]);

  const openAccept = (d: GradeDisputeWithDetails) => {
    setAcceptTarget(d);
    setRejectTarget(null);
    setTeacherResponse('');
    const current = d.grade?.grade;
    setCorrectedGradeInput(
      current != null && d.grade?.grade_status !== 'inc' ? String(current) : '',
    );
  };

  const openReject = (d: GradeDisputeWithDetails) => {
    setRejectTarget(d);
    setAcceptTarget(null);
    setTeacherResponse('');
  };

  const handleAccept = async () => {
    if (!acceptTarget?.grade?.id) return;
    const gradeToStore = gradeValueForStorage(correctedGradeInput);
    if (gradeToStore == null) {
      setAppMessage({
        title: 'Invalid grade',
        message: 'Enter a valid percentage (0–100) or grade point.',
        variant: 'warning',
      });
      return;
    }
    setResolvingId(acceptTarget.id);
    try {
      await acceptGradeDispute({
        disputeId: acceptTarget.id,
        gradeId: acceptTarget.grade.id,
        teacherResponse,
        correctedGrade: gradeToStore,
        entryStatus: 'passed',
        getGradeRemarks,
        getGradeStatus,
      });
      setAcceptTarget(null);
      await loadDisputes();
      setAppMessage({
        title: 'Dispute accepted',
        message: 'The grade has been updated and the student will be notified.',
        variant: 'success',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not accept dispute.';
      setAppMessage({ title: 'Action failed', message, variant: 'error' });
    } finally {
      setResolvingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    if (!teacherResponse.trim()) {
      setAppMessage({
        title: 'Explanation required',
        message: 'Please explain why the dispute is being rejected.',
        variant: 'warning',
      });
      return;
    }
    setResolvingId(rejectTarget.id);
    try {
      await rejectGradeDispute(rejectTarget.id, teacherResponse);
      setRejectTarget(null);
      await loadDisputes();
      setAppMessage({
        title: 'Dispute rejected',
        message: 'Your explanation has been recorded for the student.',
        variant: 'info',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not reject dispute.';
      setAppMessage({ title: 'Action failed', message, variant: 'error' });
    } finally {
      setResolvingId(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Grade Disputes">
        <PageSkeletonLoader rows={4} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Grade Disputes">
      <GlassCard variant="plain" className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <DisputeIntro pendingCount={pendingCount} />
          <div className="w-full sm:w-48">
            <Select
              label="Show"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'pending' | 'all' | 'accepted' | 'rejected')
              }
              options={[
                { value: 'pending', label: `Pending (${pendingCount})` },
                { value: 'all', label: 'All disputes' },
                { value: 'accepted', label: 'Accepted' },
                { value: 'rejected', label: 'Rejected' },
              ]}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="mt-6 text-center text-sm text-gray-500">
            {statusFilter === 'pending'
              ? 'No pending grade disputes. Students can file disputes from My Grades.'
              : 'No disputes match this filter.'}
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {filtered.map((d) => (
              <li
                key={d.id}
                className="rounded-2xl border border-gray-200 bg-gray-50/60 p-4 shadow-sm sm:p-5"
              >
                <DisputeCard
                  dispute={d}
                  resolving={resolvingId === d.id}
                  onAccept={() => openAccept(d)}
                  onReject={() => openReject(d)}
                />
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      {acceptTarget && (
        <ResolveModal
          title="Accept dispute & correct grade"
          onClose={() => !resolvingId && setAcceptTarget(null)}
        >
          <p className="text-sm text-gray-600">{buildDisputeSummaryLine(acceptTarget)}</p>
          <p className="mt-2 text-sm text-gray-700">
            <span className="font-medium">Student reason: </span>
            {acceptTarget.reason}
          </p>
          <p className="mt-1 text-sm">
            Current:{' '}
            {formatDisputedGradeDisplay(
              acceptTarget.disputed_grade ?? acceptTarget.grade?.grade,
              acceptTarget.grade?.grade_status,
            )}
          </p>
          <label htmlFor="corrected-grade" className="mt-4 block text-sm font-medium text-gray-700">
            Corrected grade (%) <span className="text-red-600">*</span>
          </label>
          <input
            id="corrected-grade"
            type="text"
            inputMode="decimal"
            value={correctedGradeInput}
            onChange={(e) => setCorrectedGradeInput(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/30"
            placeholder="e.g. 88"
          />
          <label htmlFor="accept-note" className="mt-4 block text-sm font-medium text-gray-700">
            Note to student (optional)
          </label>
          <textarea
            id="accept-note"
            rows={2}
            value={teacherResponse}
            onChange={(e) => setTeacherResponse(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            placeholder="Brief explanation of the correction…"
          />
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={!!resolvingId}
              onClick={() => setAcceptTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!!resolvingId}
              onClick={() => void handleAccept()}
            >
              {resolvingId ? 'Saving…' : 'Accept & update grade'}
            </Button>
          </div>
        </ResolveModal>
      )}

      {rejectTarget && (
        <ResolveModal
          title="Reject dispute"
          onClose={() => !resolvingId && setRejectTarget(null)}
        >
          <p className="text-sm text-gray-600">{buildDisputeSummaryLine(rejectTarget)}</p>
          <p className="mt-2 text-sm text-gray-700">
            <span className="font-medium">Student reason: </span>
            {rejectTarget.reason}
          </p>
          <label htmlFor="reject-note" className="mt-4 block text-sm font-medium text-gray-700">
            Explanation to student <span className="text-red-600">*</span>
          </label>
          <textarea
            id="reject-note"
            rows={3}
            value={teacherResponse}
            onChange={(e) => setTeacherResponse(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            placeholder="Explain why the recorded grade stands…"
          />
          <RejectActions
            resolving={!!resolvingId}
            onCancel={() => setRejectTarget(null)}
            onReject={() => void handleReject()}
          />
        </ResolveModal>
      )}

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

function DisputeIntro({ pendingCount }: { pendingCount: number }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-lg font-semibold text-[#800000]">
        <MessageSquareWarning className="h-5 w-5 shrink-0" aria-hidden />
        Student grade appeals
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-gray-600">
        Review disputes filed by your students. Accept to correct the grade, or reject with a written
        explanation. All actions are logged for academic transparency.
      </p>
      {pendingCount > 0 && (
        <p className="mt-2 text-sm font-medium text-amber-800">
          {pendingCount} dispute{pendingCount !== 1 ? 's' : ''} awaiting your review
        </p>
      )}
    </div>
  );
}

function DisputeCard({
  dispute: d,
  resolving,
  onAccept,
  onReject,
}: {
  dispute: GradeDisputeWithDetails;
  resolving: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const studentName =
    formatPersonDisplayName({
      first_name: d.student?.first_name,
      last_name: d.student?.last_name,
    }) || d.student?.user?.username || 'Student';

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-gray-900">{studentName}</p>
          <p className="mt-0.5 text-sm text-gray-600">{buildDisputeSummaryLine(d)}</p>
        </div>
        <Badge variant={disputeStatusBadgeVariant(d.status)} surface="light">
          {disputeStatusLabel(d.status)}
        </Badge>
      </div>
      <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-gray-700 ring-1 ring-gray-200">
        <span className="font-medium text-gray-800">Reason: </span>
        {d.reason}
      </p>
      {d.teacher_response && (
        <p className="mt-2 text-sm text-gray-600">
          <span className="font-medium">Your response: </span>
          {d.teacher_response}
        </p>
      )}
      <p className="mt-2 text-xs text-gray-500">
        Filed {d.created_at ? new Date(d.created_at).toLocaleString() : '—'}
      </p>
      {d.status === 'pending' && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="primary"
            className="text-sm"
            disabled={resolving}
            onClick={onAccept}
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
            Accept & edit grade
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="text-sm"
            disabled={resolving}
            onClick={onReject}
          >
            <XCircle className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
            Reject
          </Button>
        </div>
      )}
    </>
  );
}

function ResolveModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="relative m-0 max-h-[min(88dvh,100vh)] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-gray-200 bg-white p-5 shadow-2xl sm:m-4 sm:rounded-2xl sm:p-6"
      >
        <h2 className="text-lg font-semibold text-[#800000]">{title}</h2>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

function RejectActions({
  resolving,
  onCancel,
  onReject,
}: {
  resolving: boolean;
  onCancel: () => void;
  onReject: () => void;
}) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="secondary" disabled={resolving} onClick={onCancel}>
        Cancel
      </Button>
      <Button type="button" variant="primary" disabled={resolving} onClick={onReject}>
        {resolving ? 'Saving…' : 'Reject dispute'}
      </Button>
    </div>
  );
}
