# Supabase database and edge functions

SAPAS uses Supabase for authentication, Postgres data storage, row-level
security, Realtime subscriptions, RPC helper functions, and email delivery.

## Configuration files

| Path | Purpose |
| --- | --- |
| `supabase/config.toml` | Supabase CLI config for edge functions |
| `supabase/migrations/` | SQL migrations for application features |
| `supabase/functions/send-email/` | Deno Edge Function for email delivery |

`supabase/config.toml` sets:

```toml
[functions.send-email]
verify_jwt = false
```

The email function still expects callers to send the anon key in headers, but
Supabase does not require a valid user JWT before invoking the function.

## Core tables expected by the app

The current migrations are mostly additive and assume the base academic schema
already contains core tables such as `users`, `students`, `courses`, `subjects`,
`student_subjects`, and `grades`.

Important tables used by the application:

| Table | Purpose |
| --- | --- |
| `users` | App user profiles and role metadata linked to Supabase Auth identities |
| `students` | Student profile rows, course, section, year level, semester, status |
| `courses` | Academic programs |
| `subjects` | Course subjects, teacher assignment, year level, semester, schedule |
| `student_subjects` | Student enrollment rows per subject |
| `grades` | Student grades by subject, semester, grading period, school year, workflow state |
| `school_years` | School year catalog and active year flag |
| `system_announcements` | Dashboard announcement banners |
| `sections` | Official section definitions |
| `student_section_assignments` | Historical student-section assignments |
| `subject_prerequisites` | Required prior subjects for enrollment visibility |
| `student_academic_history` | Historical academic records |
| `grade_disputes` | Student grade dispute workflow |
| `attendance_records` | Per-student attendance scores by subject/date |
| `attendance_sessions` | Per-subject class/no-class sessions by date |
| `attendance_access_requests` | Teacher requests to edit locked/off-schedule attendance |
| `grading_period_deadlines` | Admin-managed grade entry deadlines |

## Important columns and status fields

### `users`

Important app-level fields include:

- `role`: `admin`, `teacher`, or `student`.
- `first_name`, `last_name`, `name`, `name_title`.
- `username`: used for generated student IDs such as `STUD-CS-1001`.
- `is_temp_password`.
- `temp_password_visible`.
- `login_failed_attempts`.
- `login_locked_until`.
- `is_dropout`: blocks student login when true.
- Password reset OTP fields added by migrations.

### `students`

Important fields include:

- `first_name`, `last_name`.
- `grade_level`: `1st`, `2nd`, `3rd`, or `4th`.
- `current_semester`: `1` or `2`.
- `course_id`.
- `section` and `section_id`.
- `user_id`.
- `student_status`: `active`, `inactive`, `graduated`, or `transferred`.

### `subjects`

Important fields include:

- `name`.
- `code`.
- `course_id`.
- `teacher_id`.
- `year_level`.
- `semester`.
- `class_days`.

### `grades`

Important fields include:

- `student_id`, `subject_id`.
- `semester`.
- `quarter`: SAPAS uses grading periods 1 to 4.
- `grade`: can contain a percentage value or an official grade point.
- `remarks`.
- `grade_status`: `passed`, `failed`, or `inc`.
- `school_year_id`.
- `workflow_status`: `draft`, `for_review`, `approved`, or `reopened`.
- `is_locked`, `locked_at`, `locked_by`.
- `unlock_requested`, `unlock_reason`, `unlock_requested_at`,
  `unlock_requested_by`.

## Grading periods

Grading periods are centralized in `src/lib/gradingPeriods.ts` and map to the
`grades.quarter` column.

Typical labels:

1. Prelims
2. Midterms
3. Semi-finals
4. Finals

The same period numbers are reused by attendance summaries.

## Grade scale

The official grade point scale is implemented in `src/lib/gradingScale.ts`.

| Percent range | Grade point | Remarks |
| --- | --- | --- |
| 98-100 | 1.00 | Excellent |
| 95-97 | 1.25 | Very Good |
| 92-94 | 1.50 | Very Good |
| 89-91 | 1.75 | Satisfactory |
| 86-88 | 2.00 | Satisfactory |
| 83-85 | 2.25 | Satisfactory |
| 80-82 | 2.50 | Satisfactory |
| 77-79 | 2.75 | Satisfactory |
| 75-76 | 3.00 | Fair |
| 74 and below | 5.00 | Failed or Conditional |

Important behavior:

- Lower grade point values are better.
- Passing is grade point `<= 3.00` and not `5.00`.
- `INC` is represented by `grade_status = 'inc'`.
- Legacy rows may contain grade points while newer teacher input can store
  percentages. Helpers normalize display and calculations.
- Official GWA is snapped to a valid grade point.

## Migration overview

The migration directory contains SQL for these feature areas:

| Area | Representative migrations |
| --- | --- |
| RLS template | `20260406000000_rls_template.sql` |
| Login lockout | `20260407120000_login_lockout.sql` |
| Grade status and admin controls | `20260504190000_grade_status_and_admin_controls.sql` |
| Attendance records and policies | `20260506185000_create_attendance_records.sql`, `20260506190000_attendance_records_rls_policies.sql` |
| Dropout account lock | `20260509162000_add_dropout_account_lock.sql` |
| Academic workflow foundations | `20260511190000_academic_workflow_foundations.sql` |
| School year enforcement on grades | `20260511200500_grades_school_year_enforcement.sql` |
| Sections and promotion | `20260511210000_section_year_level_management.sql` |
| Password reset OTP and confirmation | `20260515140000_password_reset_otp.sql`, `20260515120000_password_reset_confirm_token.sql` |
| Subject class days and codes | `20260515160000_subject_class_days.sql`, `20260515180000_subject_code.sql` |
| Attendance sessions | `20260515170000_attendance_sessions.sql` |
| Student semester and prerequisites | `20260517130000_student_semester_prerequisites.sql`, `20260517140000_subject_prerequisites_rls.sql` |
| Advancement rules | `20260517150000_block_semester_advance_on_failure.sql`, `20260517170000_fix_advance_pass_standing.sql`, `20260517180000_advance_students_partial.sql`, `20260517190000_advance_with_failed_back_subjects.sql` |
| Attendance schedules and requests | `20260519120000_attendance_scores_quarter.sql`, `20260519130000_attendance_sessions_rls_hotfix.sql`, `20260519140000_attendance_schedule_lock.sql` |
| Grading deadlines | `20260519150000_grading_period_deadlines.sql` |
| Grade disputes | `20260519160000_grade_disputes_workflow.sql`, `20260519170000_grade_disputes_resolution_seen.sql` |

Review migrations before applying them to a production database. Some are
hotfix-style policies and several are designed to be backward compatible with
existing data.

## Applying migrations

If your Supabase project is linked locally:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

For a local Supabase stack:

```bash
supabase start
supabase db reset
```

If applying manually through the Supabase SQL editor, run migrations in
filename order.

## RPC functions used by workflows

Migrations define helper functions for:

- Login lockout and reset after successful auth.
- Active school year lookup.
- Grade school year assignment.
- Grade subject/semester enforcement.
- Grading deadline lock application.
- Attendance timestamp updates.
- Student prerequisite checks.
- Student semester advancement.
- Student promotion.
- Reverting students to first semester.
- Deleting sections.
- Grade display percent normalization.
- Subject final standing.

Client code calls some RPC functions directly and relies on others through
triggers.

## RLS and access model

The application expects Supabase RLS to protect data access. Migrations include
policies for newer tables and hotfix policies for some existing tables.

Important notes:

- Some migrations use permissive `anon, authenticated` policies for feature
  compatibility.
- Client-side route protection is not a substitute for RLS.
- Review RLS policies before production use if stricter tenant or role
  boundaries are required.
- Teacher and student pages often filter by the current user in client queries,
  but database policies should still enforce ownership.

## Realtime tables

The app subscribes to changes from tables such as:

- `system_announcements`
- `school_years`
- `grading_period_deadlines`
- `grades`
- `grade_disputes`
- `attendance_access_requests`

If Realtime is disabled for a table in Supabase, the app still works after
manual refresh, but live notifications and auto-refresh behavior will be
reduced.

## Edge Function: `send-email`

Path:

```text
supabase/functions/send-email/index.ts
```

Responsibilities:

- Handle CORS preflight.
- Accept POST requests containing `email`, `subject`, and `html`.
- Validate required fields.
- Read `BREVO_API_KEY` and `EMAIL_FROM` from Supabase Edge Function secrets.
- Send the email through Brevo's `/v3/smtp/email` API.
- Return JSON success or error responses.

Required secrets:

```bash
BREVO_API_KEY="your-brevo-api-key"
EMAIL_FROM="SAPAS <verified-sender@example.com>"
```

Deploy command:

```bash
supabase functions deploy send-email
```

Set secrets:

```bash
supabase secrets set BREVO_API_KEY="your-brevo-api-key"
supabase secrets set EMAIL_FROM="SAPAS <verified-sender@example.com>"
```

Local function serving:

```bash
supabase functions serve send-email
```

## Email call path

1. UI creates an email template in `src/api/email.ts`.
2. `sendEmail()` posts to `{supabaseUrl}/functions/v1/send-email`.
3. Request headers include:
   - `Content-Type: application/json`
   - `Authorization: Bearer {anon key}`
   - `apikey: {anon key}`
4. Edge Function calls Brevo.
5. UI receives `{ success: true }` or an error string.

## Operational checks

After applying database or edge function changes:

1. Sign in as each role.
2. Confirm dashboard data loads.
3. Create or edit a course, subject, and section as admin.
4. Encode a grade as teacher.
5. View the grade as student.
6. Submit and resolve a grade dispute.
7. Record attendance on a scheduled date.
8. Submit and review an attendance access request.
9. Send a credential or password reset email.

## Backups and production care

Before applying migrations to production:

- Take a Supabase database backup.
- Review table locks or long-running operations.
- Verify migrations in a staging project.
- Confirm RLS policy changes match the desired production security model.
- Confirm Edge Function secrets are set before enabling email-dependent flows.
