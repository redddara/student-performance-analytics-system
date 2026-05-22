# Development guide

This guide describes conventions and useful implementation details for working
on SAPAS.

## Commands

```bash
npm ci
npm run dev
npm run typecheck
npm run build
npm run preview
npm start
```

There is no configured automated test runner at this time. Use
`npm run typecheck` and targeted manual smoke tests after changes.

## Code style

The codebase uses:

- TypeScript with `strict: true`.
- React function components and hooks.
- Tailwind utility classes.
- Zustand for app-level stores.
- Supabase client calls directly from pages and helper modules.
- Single quotes in most TypeScript/TSX files.
- Semicolons in TypeScript/TSX files.

Prefer existing local helpers before adding new abstractions. For example:

- Use grade helpers from `src/lib/gradingScale.ts`.
- Use grading period labels from `src/lib/gradingPeriods.ts`.
- Use student academic visibility helpers from `src/lib/studentAcademicRules.ts`.
- Use person-name formatting from `src/lib/personName.ts`.
- Use Supabase live reload helpers from `src/lib/useSupabaseLiveReload.ts`.

## Path aliases

`vite.config.ts` defines:

```ts
'@': path.resolve(__dirname, './src')
```

Existing code mostly uses relative imports. Either style can work, but keep
imports consistent with nearby files.

## TypeScript configuration

`tsconfig.json` includes:

- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- `isolatedModules: true`
- `moduleResolution: bundler`

Only `src` is included in TypeScript checking.

## Adding pages

To add a new route:

1. Create the page under the role folder in `src/pages`.
2. Import it in `src/App.tsx`.
3. Add a nested route under the correct role path.
4. Add a navigation item in `DashboardLayout.tsx` if it should appear in the
   sidebar.
5. Confirm role redirects still behave correctly.

Protected routes should remain scoped by role:

- Admin-only under `/admin/*`.
- Teacher-only under `/teacher/*`.
- Student-only under `/student/*`.

## Adding shared UI

Shared UI components live in `src/components/ui`.

Before adding a new page-level custom control, check whether an existing
component already covers the need:

- `Button`
- `Input`
- `Select`
- `Table`
- `Badge`
- `GlassCard`
- `ConfirmModal`
- `MessageModal`
- `Spinner`
- skeleton loaders

Keep complex page-specific state in the page unless it is reused by multiple
features.

## Working with Supabase

The shared Supabase client is exported from `src/lib/supabase.ts`.

Do:

- Keep environment variables out of source.
- Use existing helper modules for domain-specific queries and formatting.
- Handle Supabase errors and show user-friendly messages.
- Consider RLS implications when adding queries.
- Add SQL migrations for schema changes.

Avoid:

- Hard-coding project URLs or keys.
- Assuming client-side role checks are sufficient for data security.
- Duplicating grade, attendance, or academic rules in page components when a
  helper already exists.

## Adding schema changes

1. Add a timestamped SQL migration under `supabase/migrations`.
2. Make migrations safe to re-run where practical by using `if not exists`,
   `drop policy if exists`, or guarded `do $$` blocks.
3. Add indexes for new query patterns.
4. Add or update RLS policies.
5. Update `src/types/index.ts` if shared app types change.
6. Update docs when the data model or operational steps change.

Migration filenames use this pattern:

```text
YYYYMMDDHHMMSS_description.sql
```

## Grade-related development notes

Grade logic is central and should stay consistent across admin, teacher, and
student views.

Use `src/lib/gradingScale.ts` for:

- Grade point conversion.
- Percentage display.
- Pass/fail status.
- GWA formatting.
- Official grade scale labels.

Use `src/lib/subjectSemester.ts` for subject-semester normalization.

Use `src/lib/gradingPeriodDeadlines.ts` for deadline checks and notifications.

Do not reimplement the grade scale in page components.

## Attendance-related development notes

Attendance logic is split across:

- `src/lib/attendance.ts` - score/status normalization and summaries.
- `src/lib/attendanceAccess.ts` - edit access rules.
- `src/lib/classSchedule.ts` - scheduled class-day checks.
- `src/lib/attendanceExport.ts` - export helpers.

Attendance scores are:

- Present: 100
- Late: 50
- Absent: 0

No-class sessions should not count toward attendance summaries.

## Student academic rules

Student subject visibility and advancement rules are concentrated in
`src/lib/studentAcademicRules.ts`.

Important concepts:

- Current semester.
- Future-semester subjects.
- Past-term subjects.
- Back subjects.
- Failed carry-over subjects.
- Prerequisite checks.
- Active-school-year grade filtering.

When changing these rules, verify all three roles:

- Admin section/promotion workflows.
- Teacher grade rosters.
- Student subject and grade views.

## Email templates

Client email template generation is in `src/api/email.ts`.

Current template types:

- New student/teacher/admin account credentials.
- Password reset OTP.
- Password reset temporary password.

The Edge Function sends arbitrary HTML, so sanitize or control any user-provided
content before including it in templates.

## Realtime reload pattern

Use `useSupabaseLiveReload` when a page should refresh after table changes.
Keep callbacks stable with `useCallback` to avoid unnecessary subscription
churn.

Realtime callbacks should usually reload server state instead of mutating large
local caches by hand.

## Manual smoke tests

After a feature change, run the relevant subset:

### Auth

- Sign in as each role.
- Confirm role redirects.
- Confirm logout and cross-tab logout.
- Confirm temporary-password flow if touched.

### Admin

- Load dashboard.
- Create or edit course/subject/section data.
- Open users page and verify student/teacher lists.
- Open academic page and verify active school year/deadline data.
- Review grade workflow alerts if grade flow changed.

### Teacher

- Load assigned subjects.
- Enter a grade.
- Upload or preview a grade spreadsheet if upload logic changed.
- Submit grades for review.
- Mark attendance on a scheduled day.
- Submit attendance access request for a blocked date.
- Resolve a grade dispute if dispute logic changed.

### Student

- Load subjects and schedule.
- Load grades and official report.
- Submit a grade dispute.
- Check analytics if grade data changed.

## Build output

`dist/` is checked into the repository. If you run `npm run build`, Vite may
update generated assets. Commit built assets only when that is intended for the
change.

## Documentation updates

Update docs when changing:

- Environment variables.
- Build or deploy commands.
- Routes.
- Database tables, columns, policies, or functions.
- Role workflows.
- Grade, attendance, or advancement rules.
- Email behavior.
