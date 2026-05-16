import { AlertTriangle, BookMarked, CheckCircle2 } from 'lucide-react';
import { semesterLabelForStudent } from '../../lib/studentAcademicRules';

type Props = {
  currentSemester: number;
  backSubjectCount: number;
  hiddenByPrerequisiteCount: number;
};

export function StudentAcademicBanner({
  currentSemester,
  backSubjectCount,
  hiddenByPrerequisiteCount,
}: Props) {
  return (
    <div className="mb-6 space-y-3">
      <div className="rounded-2xl border border-maroon-200/60 bg-maroon-50/80 px-4 py-3 text-sm text-maroon-950 sm:px-5">
        <p className="font-semibold text-[#800000]">Current term: {semesterLabelForStudent(currentSemester)}</p>
        <p className="mt-1 text-maroon-900/90">
          You see your current-term subjects plus earlier subjects from this year (previous term) and any back subjects
          you still need to pass.
        </p>
      </div>
      {backSubjectCount > 0 ? (
        <div className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:px-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
          <div>
            <p className="font-semibold">
              {backSubjectCount} back subject{backSubjectCount !== 1 ? 's' : ''}
            </p>
            <p className="mt-0.5">
              These are subjects you must repeat (failed from a previous term or an earlier year level).
            </p>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 sm:px-5">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700" aria-hidden />
          <p className="font-medium">No back subjects — you are clear on carry-over requirements for now.</p>
        </div>
      )}
      {hiddenByPrerequisiteCount > 0 && (
        <div className="flex gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 sm:px-5">
          <BookMarked className="mt-0.5 h-5 w-5 shrink-0 text-gray-600" aria-hidden />
          <p>
            {hiddenByPrerequisiteCount} subject{hiddenByPrerequisiteCount !== 1 ? 's are' : ' is'} hidden until you pass
            the required prerequisite (for example, Thesis 1 before Thesis 2).
          </p>
        </div>
      )}
    </div>
  );
}
