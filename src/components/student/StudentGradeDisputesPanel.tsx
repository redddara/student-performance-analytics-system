import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, History, MessageSquareWarning } from 'lucide-react';
import {
  Badge,
  Button,
  GlassCard,
  MessageModal,
  PageSkeletonLoader,
  type AppMessagePayload,
} from '../ui';
import {
  buildDisputeSummaryLine,
  disputeStatusBadgeVariant,
  disputeStatusLabel,
  fetchPendingDisputeGradeIds,
  fetchStudentDisputes,
  formatDisputedGradeDisplay,
  submitGradeDispute,
  type GradeDisputeWithDetails,
} from '../../lib/gradeDisputes';
import { gradingPeriodLabel } from '../../lib/gradingPeriods';
import { formatPersonDisplayName } from '../../lib/personName';

type GradeRow = {
  id: string;
  grade: number;
  quarter: number;
  semester: number;
  grade_status?: string;
  subject?: {
    id?: string;
    name?: string;
    code?: string;
    teacher_id?: string;
    teacher?: { id?: string; first_name?: string; last_name?: string; name?: string; name_title?: string | null };
  };
};

type Props = {
  studentId: string;
  grades: GradeRow[];
  onDisputesChanged?: () => void;
};

export function StudentGradeDisputesPanel({ studentId, grades, onDisputesChanged }: Props) {
  const [disputes, setDisputes] = useState<GradeDisputeWithDetails[]>([]);
  const [pendingGradeIds, setPendingGradeIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<GradeRow | null>(null);
  const [reason, setReason] = useState('');
  const [appMessage, setAppMessage] = useState<AppMessagePayload | null>(null);

  const loadDisputes = useCallback(async () => {
    try {
      const [list, pending] = await Promise.all([
        fetchStudentDisputes(studentId),
        fetchPendingDisputeGradeIds(studentId),
      ]);
      setDisputes(list);
      setPendingGradeIds(pending);
    } catch (err: unknown) {
      console.error(err);
      setDisputes([]);
      setPendingGradeIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void loadDisputes();
  }, [loadDisputes]);

  const disputableGrades = useMemo(() => {
    return [...grades]
      .filter((g) => g.id && (g.grade != null || g.grade_status === 'inc'))
      .sort((a, b) => {
        const subA = a.subject?.name || '';
        const subB = b.subject?.name || '';
        if (subA !== subB) return subA.localeCompare(subB);
        if (a.semester !== b.semester) return a.semester - b.semester;
        return a.quarter - b.quarter;
      });
  }, [grades]);

  const openDisputeModal = (grade: GradeRow) => {
    setSelectedGrade(grade);
    setReason('');
  };

  const handleSubmitDispute = async () => {
    if (!selectedGrade) return;
    setSubmitting(true);
    try {
      const teacherId =
        selectedGrade.subject?.teacher_id || selectedGrade.subject?.teacher?.id || null;
      await submitGradeDispute({
        gradeId: selectedGrade.id,
        studentId,
        teacherId,
        reason,
        disputedGrade:
          selectedGrade.grade_status === 'inc' ? null : Number(selectedGrade.grade),
      });
      setSelectedGrade(null);
      setReason('');
      await loadDisputes();
      onDisputesChanged?.();
      setAppMessage({
        title: 'Dispute submitted',
        message:
          'Your teacher has been notified. You can track the status in your dispute history below.',
        variant: 'success',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not submit dispute. Please try again.';
      setAppMessage({ title: 'Submission failed', message, variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <GlassCard variant="plain" className="p-4 sm:p-6">
        <PageSkeletonLoader rows={2} />
      </GlassCard>
    );
  }

  return (
    <>
      <GlassCard variant="plain" className="p-4 sm:p-6 print:hidden">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[#800000]">
          <MessageSquareWarning className="h-5 w-5 shrink-0" aria-hidden />
          Grade disputes &amp; appeals
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          If you believe a recorded grade is incorrect, submit a dispute here instead of visiting the
          teacher in person. Your teacher will review it and accept (with a grade correction) or reject
          with an explanation. All disputes are kept on record.
        </p>

        {disputableGrades.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No graded entries available to dispute yet.</p>
        ) : (
          <DisputeGradesTable
            disputableGrades={disputableGrades}
            pendingGradeIds={pendingGradeIds}
            onDispute={openDisputeModal}
          />
        )}

        <section className="mt-8 border-t border-gray-200 pt-6">
          <h3 className="flex items-center gap-2 text-base font-semibold text-[#800000]">
            <History className="h-5 w-5 shrink-0" aria-hidden />
            Dispute history
          </h3>
          {disputes.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">No disputes filed yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {disputes.map((d) => (
                <li
                  key={d.id}
                  className="rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm"
                >
                  <DisputeHistoryItem dispute={d} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </GlassCard>

      {selectedGrade && (
        <DisputeFormModal
          grade={selectedGrade}
          reason={reason}
          submitting={submitting}
          onReasonChange={setReason}
          onClose={() => !submitting && setSelectedGrade(null)}
          onSubmit={() => void handleSubmitDispute()}
        />
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
    </>
  );
}

function DisputeFormModal({
  grade,
  reason,
  submitting,
  onReasonChange,
  onClose,
  onSubmit,
}: {
  grade: GradeRow;
  reason: string;
  submitting: boolean;
  onReasonChange: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const canSubmit = reason.trim().length >= 10;
  return (
    <DisputeFormShell onClose={onClose}>
      <h2 id="dispute-modal-title" className="text-lg font-semibold text-[#800000]">
        File grade dispute
      </h2>
      <p className="mt-2 text-sm text-gray-600">
        {grade.subject?.name || 'Subject'} · {grade.semester === 2 ? '2nd Sem' : '1st Sem'} ·{' '}
        {gradingPeriodLabel(grade.quarter)}
      </p>
      <p className="mt-1 text-sm font-medium text-gray-800">
        Recorded grade: {formatDisputedGradeDisplay(grade.grade, grade.grade_status)}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Teacher: {formatPersonDisplayName(grade.subject?.teacher || {}) || '—'}
      </p>
      <label htmlFor="dispute-reason" className="mt-4 block text-sm font-medium text-gray-700">
        Why do you believe this grade is wrong? <span className="text-red-600">*</span>
      </label>
      <textarea
        id="dispute-reason"
        rows={4}
        value={reason}
        onChange={(e) => onReasonChange(e.target.value)}
        placeholder="Explain the error (e.g. missing score, wrong computation, attendance already excused…)"
        className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/30"
      />
      <p className="mt-1 text-xs text-gray-500">At least 10 characters required.</p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" disabled={submitting} onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" variant="primary" disabled={submitting || !canSubmit} onClick={onSubmit}>
          {submitting ? 'Submitting…' : 'Submit dispute'}
        </Button>
      </div>
    </DisputeFormShell>
  );
}

function DisputeFormShell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4 print:hidden">
      <DisputeFormOverlay onClose={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispute-modal-title"
        className="relative m-0 max-h-[min(88dvh,100vh)] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-gray-200 bg-white p-5 shadow-2xl sm:m-4 sm:rounded-2xl sm:p-6"
      >
        {children}
      </div>
    </div>
  );
}

function DisputeFormOverlay({ onClose }: { onClose: () => void }) {
  return <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={onClose} aria-hidden />;
}

function DisputeGradesTable({
  disputableGrades,
  pendingGradeIds,
  onDispute,
}: {
  disputableGrades: GradeRow[];
  pendingGradeIds: Set<string>;
  onDispute: (g: GradeRow) => void;
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase text-gray-600">
            <th className="px-3 py-2">Subject</th>
            <th className="px-3 py-2">Period</th>
            <th className="px-3 py-2">Grade</th>
            <th className="px-3 py-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {disputableGrades.map((g) => {
            const pending = pendingGradeIds.has(g.id);
            return (
              <tr key={g.id} className="border-b border-gray-100 last:border-0">
                <td className="px-3 py-2.5">
                  <span className="font-medium text-gray-900">{g.subject?.name || '—'}</span>
                  {g.subject?.code && (
                    <span className="ml-1 font-mono text-xs text-gray-500">{g.subject.code}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-gray-700">
                  {g.semester === 2 ? '2nd Sem' : '1st Sem'} · {gradingPeriodLabel(g.quarter)}
                </td>
                <td className="px-3 py-2.5 tabular-nums font-medium">
                  {formatDisputedGradeDisplay(g.grade, g.grade_status)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {pending ? (
                    <Badge variant="warning" surface="light">
                      Pending review
                    </Badge>
                  ) : (
                    <Button type="button" variant="secondary" className="text-xs" onClick={() => onDispute(g)}>
                      Dispute
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DisputeHistoryItem({ dispute: d }: { dispute: GradeDisputeWithDetails }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant={disputeStatusBadgeVariant(d.status)} surface="light">
          {disputeStatusLabel(d.status)}
        </Badge>
        {d.status === 'pending' && (
          <span className="flex items-center gap-1 text-xs text-amber-800">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden />
            Awaiting teacher review
          </span>
        )}
      </div>
      <p className="mt-1 text-gray-700">{buildDisputeSummaryLine(d)}</p>
      <p className="mt-2 text-gray-600">
        <span className="font-medium text-gray-800">Your reason: </span>
        {d.reason}
      </p>
      {d.teacher_response && (
        <p className="mt-2 rounded-lg bg-white px-3 py-2 text-gray-700 ring-1 ring-gray-200">
          <span className="font-medium text-gray-800">Teacher response: </span>
          {d.teacher_response}
          {d.status === 'accepted' && d.corrected_grade != null && (
            <span className="mt-1 block font-medium text-[#800000]">
              Corrected grade: {formatDisputedGradeDisplay(d.corrected_grade)}
            </span>
          )}
        </p>
      )}
      <p className="mt-2 text-xs text-gray-500">
        Filed {d.created_at ? new Date(d.created_at).toLocaleString() : '—'}
        {d.resolved_at && ` · Resolved ${new Date(d.resolved_at).toLocaleString()}`}
      </p>
    </>
  );
}
