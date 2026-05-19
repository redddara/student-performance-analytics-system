export type OnboardingTourStep = {
  target: string;
  title: string;
  body: string;
  /** Open mobile sidebar before highlighting nav targets. */
  openSidebar?: boolean;
};

export const teacherOnboardingSteps: OnboardingTourStep[] = [
  {
    target: 'page-header',
    title: 'Welcome to your dashboard',
    body: 'This is your home base — a quick snapshot of your classes, deadlines, and recent activity.',
  },
  {
    target: 'nav-subjects',
    title: 'My Subjects',
    body: 'Open My Subjects to see every class you teach, student rosters, and subject details.',
    openSidebar: true,
  },
  {
    target: 'nav-grades',
    title: 'Encode grades',
    body: 'Use Grades to enter quarter scores, submit for review, and request unlocks when a period is locked.',
    openSidebar: true,
  },
  {
    target: 'notifications',
    title: 'Stay on top of deadlines',
    body: 'The bell shows grading deadlines, dispute updates, and school announcements so nothing slips through.',
  },
  {
    target: 'nav-analytics',
    title: 'Class analytics',
    body: 'Analytics breaks down passing rates, grade trends, and performance by subject — great for parent meetings.',
    openSidebar: true,
  },
];

export const studentOnboardingSteps: OnboardingTourStep[] = [
  {
    target: 'page-header',
    title: 'Welcome to your dashboard',
    body: 'Your dashboard shows your current GWA, enrolled subjects, and the latest updates at a glance.',
  },
  {
    target: 'nav-subjects',
    title: 'My Subjects',
    body: 'My Subjects lists every class you are enrolled in this term, with teachers and schedules.',
    openSidebar: true,
  },
  {
    target: 'nav-grades',
    title: 'View your grades',
    body: 'My Grades shows your quarter scores by subject. You can file a dispute here if something looks wrong.',
    openSidebar: true,
  },
  {
    target: 'notifications',
    title: 'Important updates',
    body: 'Check the bell for dispute resolutions and school announcements that affect you.',
  },
  {
    target: 'nav-analytics',
    title: 'Your analytics',
    body: 'Analytics tracks your GWA trend, subject performance, and how you compare across terms.',
    openSidebar: true,
  },
];

export function getOnboardingStepsForRole(
  role: string | undefined
): OnboardingTourStep[] | null {
  if (role === 'teacher') return teacherOnboardingSteps;
  if (role === 'student') return studentOnboardingSteps;
  return null;
}
