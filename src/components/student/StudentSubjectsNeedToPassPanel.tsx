import { Target } from 'lucide-react';
import { GlassCard } from '../ui';
import {
  formatRequiredScoreMessage,
  TOTAL_GRADING_PERIODS,
  type SubjectNeedToPassRow,
} from '../../lib/subjectPassRecovery';

type Props = {
  subjects: SubjectNeedToPassRow[];
  schoolYearLabel?: string;
  semesterLabel?: string;
};

export function StudentSubjectsNeedToPassPanel({
  subjects,
  schoolYearLabel,
  semesterLabel,
}: Props) {
  const scopeParts = [schoolYearLabel, semesterLabel].filter((p): p is string => Boolean(p));

  return (
    <GlassCard className="mb-8 p-4 sm:p-6">
      <PanelHeader scopeParts={scopeParts} />

      {subjects.length === 0 ? (
        <p className="rounded-xl bg-green-50 px-4 py-6 text-center text-sm text-green-800">
          None of your subjects are below the 75% passing line based on posted grades this term.
          Keep it up.
        </p>
      ) : (
        <ul className="space-y-3">
          {subjects.map((row) => (
            <li
              key={row.subjectId}
              className="rounded-xl border border-red-100 bg-red-50/60 p-4 sm:p-5"
            >
              <SubjectAtRiskCard row={row} />
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}

function PanelHeader({ scopeParts }: { scopeParts: string[] }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold text-[#800000]">
          <Target className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          Subjects I Need to Pass
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          Subjects where your posted average is below 75%, with the score you need in remaining
          periods to still pass (75% final average across Prelims, Midterms, Semi-Finals, and
          Finals).
        </p>
      </div>
      {scopeParts.length > 0 && (
        <p className="text-xs text-gray-500 sm:text-right">{scopeParts.join(' · ')}</p>
      )}
    </div>
  );
}

function SubjectAtRiskCard({ row }: { row: SubjectNeedToPassRow }) {
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold text-gray-900">{row.subjectName}</h3>
        <span className="text-sm font-medium text-red-700">
          Current average: {row.currentAveragePercent}%
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3 sm:gap-4">
        <Stat label="Periods graded" value={`${row.completedPeriodCount} of ${TOTAL_GRADING_PERIODS}`} />
        <Stat
          label="Periods remaining"
          value={row.remainingPeriodCount === 0 ? 'None' : String(row.remainingPeriodCount)}
        />
        <Stat
          label={
            row.remainingPeriodCount === 1 && row.nextPeriodLabel
              ? `Score needed in ${row.nextPeriodLabel}`
              : 'Score needed (each remaining)'
          }
          value={
            row.requiredPercentPerRemaining != null
              ? row.achievable
                ? `${row.requiredPercentPerRemaining}%`
                : 'Not achievable'
              : '—'
          }
          highlight={row.achievable && row.requiredPercentPerRemaining != null}
        />
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-red-900/90">
        {formatRequiredScoreMessage(row)}
      </p>
    </>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd
        className={
          highlight ? 'text-lg font-bold text-[#800000]' : 'font-semibold text-gray-800'
        }
      >
        {value}
      </dd>
    </div>
  );
}
