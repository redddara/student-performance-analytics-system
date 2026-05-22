# Architecture and code map

SAPAS is a frontend-heavy single-page application backed by Supabase. The
browser app owns most workflow orchestration, while Supabase provides
persistence, authentication, database policies, server-side helper functions,
Realtime notifications, and email delivery through an Edge Function.

## High-level runtime flow

```text
Browser
  |
  | React Router routes
  v
React app in src/
  |
  | supabase-js
  v
Supabase
  |
  +-- Auth sessions
  +-- Postgres tables
  +-- RLS policies
  +-- RPC functions
  +-- Realtime channels
  +-- Edge Function: send-email
```

For production hosting, `server.js` serves the Vite build output in `dist/` and
uses SPA fallback for all app routes.

## Entrypoints

| File | Responsibility |
| --- | --- |
| `index.html` | Vite HTML shell, metadata, app root, Hugeicons font, clickjacking frame-break script |
| `src/main.tsx` | React root bootstrap |
| `src/App.tsx` | Router tree, route protection, auth hydration, inactivity timeout, cross-tab logout |
| `server.js` | Production Express static server |
| `supabase/functions/send-email/index.ts` | Deno edge function for SMTP email via Brevo |

## Routing and role protection

`src/App.tsx` defines the app routes. The `ProtectedRoute` component:

1. Waits for auth loading to finish.
2. Redirects anonymous users to `/login`.
3. Checks the current user's role against the route's allowed roles.
4. Redirects authenticated users to their own role dashboard when they access a
   route for another role.

The root route redirects by role:

- Admin -> `/admin/dashboard`
- Teacher -> `/teacher/dashboard`
- Student -> `/student/dashboard`

## Auth and session lifecycle

Auth is coordinated by:

- `src/lib/supabase.ts`
- `src/store/index.ts`
- `src/lib/authProfile.ts`
- `src/lib/profileStorage.ts`
- `src/lib/sessionConstants.ts`
- `src/App.tsx`

Important behaviors:

- Supabase Auth is configured with a custom storage adapter.
- The app stores a sanitized user profile in local storage for app state
  hydration.
- Password hashes are stripped before persisting user data in the Zustand auth
  store.
- Inactivity logout is enforced after 30 minutes.
- A warning modal appears shortly before the inactivity timeout.
- Logout is synchronized across tabs using local storage events.
- Session changes from Supabase Auth can rehydrate the app user profile.

## State management

`src/store/index.ts` defines three Zustand stores:

- `useAuthStore` - current user, loading state, logout.
- `useDataStore` - shared lists of courses, subjects, students, teachers,
  grades, and student-subject enrollments.
- `useUIStore` - sidebar and active tab state.

Many pages also keep local component state for filters, table pagination, modal
state, and form drafts.

## Layout and navigation

`src/components/layouts/DashboardLayout.tsx` is the main authenticated shell.
It renders role-specific navigation:

Admin:

- Dashboard
- Grades
- Users
- Courses
- Subjects
- Attendance Access
- Sections
- Academic
- Analytics

Teacher:

- Dashboard
- My Subjects
- Grades
- Disputes
- Students
- Attendance
- Analytics

Student:

- Dashboard
- My Subjects
- My Schedule
- My Grades
- Analytics

The layout also loads:

- Active system announcements.
- Admin grade workflow and attendance access alerts.
- Teacher grading deadline alerts.
- Teacher/student grade dispute notifications.
- Per-role onboarding tour steps.

## Source directory map

### `src/pages`

Route-level pages grouped by role.

```text
src/pages/auth      Login and password flows
src/pages/admin     Admin dashboards and management screens
src/pages/teacher   Teacher dashboards, grades, attendance, disputes
src/pages/student   Student dashboards, subjects, schedule, grades, analytics
```

### `src/components`

Reusable UI, layout, onboarding, auth, and student-focused components.

Important areas:

- `components/layouts` - authenticated and auth page layouts.
- `components/ui` - buttons, cards, tables, modals, loaders, badges, inputs.
- `components/student` - academic banners, dispute panel, official grade
  report, subjects-to-pass panel.
- `components/onboarding` - role onboarding tour UI.

### `src/lib`

Domain logic and shared helpers. Important modules include:

| File | Responsibility |
| --- | --- |
| `supabase.ts` | Supabase client, auth storage, student username helpers, grade exports |
| `gradingScale.ts` | Institutional grade point scale, grade parsing, GWA helpers |
| `gradingPeriods.ts` | Prelim, midterm, semi-finals, finals labels |
| `gradingPeriodDeadlines.ts` | Deadline queries, lock checks, notifications |
| `studentAcademicRules.ts` | Prerequisites, back subjects, advancement visibility |
| `officialGradeReport.ts` | Student official report row and GPA helpers |
| `gradeDisputes.ts` | Dispute CRUD, formatting, notifications |
| `attendance.ts` | Attendance scoring and summaries |
| `attendanceAccess.ts` | Attendance edit access resolution |
| `attendanceExport.ts` | Attendance export helpers |
| `bulkGradeUploadPreview.ts` | Spreadsheet preview and validation |
| `classSchedule.ts` | Class day parsing and schedule checks |
| `officialSections.ts` | Official section formatting and filtering |
| `subjectSemester.ts` | Subject catalog semester normalization |
| `authProfile.ts` | User profile lookup after Supabase auth events |
| `loginLock.ts` | Login lockout constants and formatting |
| `profileStorage.ts` | Local/session storage helpers for profile data |
| `useSupabaseLiveReload.ts` | Shared Realtime reload hook |
| `analyticsData.ts` | Analytics data preparation |

### `src/api`

Client-side wrappers for API-like calls. Currently this contains `email.ts`,
which invokes the Supabase `send-email` Edge Function and generates email HTML
templates for account credentials and password resets.

### `src/types`

Shared app types such as:

- `User`
- `Course`
- `Subject`
- `Student`
- `Grade`
- `GradeDispute`
- `StudentSubject`
- analytics summaries
- semester and year-level constants

## Important workflows

### Login and auth profile hydration

1. User signs in through Supabase Auth or the app's credential flow.
2. `AppInitializer` checks the current Supabase session.
3. The app loads the matching row from `users`.
4. The Zustand auth store receives a sanitized user object.
5. Protected routes become available based on the user's role.

### Grade entry

1. Teacher selects subject, semester, grading period, and student.
2. Grade input is parsed with `gradingScale.ts`.
3. Percent inputs can be stored as percentages; official grade point display is
   normalized from the grade scale.
4. New or updated rows are written to `grades`.
5. Workflow status and lock fields determine whether teachers can continue
   editing.
6. Admins can review submissions, approve rows, and reopen or unlock grades.

### Bulk grade upload

1. Teacher uploads a spreadsheet on the grades page.
2. `bulkGradeUploadPreview.ts` builds a preview by matching spreadsheet rows to
   enrolled students and existing grade rows.
3. Invalid rows are reported before saving.
4. Valid rows are inserted or updated in `grades`.

### Grading period deadlines

1. Admin configures deadlines on the Academic page.
2. Deadlines are stored in `grading_period_deadlines`.
3. `apply_grading_period_deadline_locks()` marks matching grade rows locked
   when deadlines pass.
4. Teacher grade entry checks deadline state even if no row exists yet.
5. Teacher deadline notifications appear in the dashboard shell.

### Attendance

1. Subjects can define weekly class days.
2. Teachers mark a date as class or no class through `attendance_sessions`.
3. Attendance records store scores: present = 100, late = 50, absent = 0.
4. Off-schedule or locked dates require an attendance access request.
5. Admins review attendance access requests.

### Student advancement

Academic advancement is split across client helpers and database functions:

- Students track `grade_level` and `current_semester`.
- Subject catalog semester determines current, future, and past-term subjects.
- Prerequisites are modeled in `subject_prerequisites`.
- Failed lower-year or failed prior-semester subjects can appear as back
  subjects.
- RPC functions promote students, advance students to second semester, and
  preserve historical enrollments where required.

### Grade disputes

1. Student submits a dispute for a grade row.
2. A unique partial index allows only one pending dispute per grade.
3. Teacher sees pending disputes in `/teacher/disputes` and notifications.
4. Teacher accepts and updates the grade, or rejects with a response.
5. Student receives a resolution notification and can acknowledge it.

## Realtime behavior

`useSupabaseLiveReload.ts` centralizes subscriptions for pages that should
reload when Supabase tables change. Examples:

- Academic page listens to school years and announcements.
- Dashboard layout listens to announcements, grade workflow rows, attendance
  access requests, deadlines, and disputes.
- Grades pages use grade auto-refresh helpers.

Realtime reloads are intentionally coarse: changed rows trigger page-level data
reloads instead of local optimistic cache reconciliation.

## Styling

Tailwind CSS is configured in `tailwind.config.js`.

Theme conventions:

- Maroon and gold brand palette.
- Glassmorphism card and shadow utilities.
- Inter-style sans font stack.
- Responsive layouts built with Tailwind utilities.

Shared primitives in `src/components/ui` should be preferred over one-off page
controls when adding new interface elements.

## Production serving model

The production app is still a static SPA:

1. `npm run build` creates `dist/`.
2. `npm start` starts Express.
3. Express serves files from `dist/`.
4. Any route not matched by a static file receives `index.html`.
5. React Router handles the route in the browser.

The `dist/` directory is currently checked into the repository. If build output
is regenerated, review the compiled assets carefully before committing.
