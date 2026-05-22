# User guide

This guide describes how the application is intended to be used by each role.
Exact button labels can change as the UI evolves, but the workflows below match
the current route structure and domain logic.

## Roles

SAPAS has three user roles:

- Admin
- Teacher
- Student

Users are redirected to the dashboard for their role after sign-in.

## Sign in and session behavior

1. Open `/login`.
2. Enter the credential for the account.
   - Students commonly use generated student IDs such as `STUD-CS-1001`.
   - Teachers and admins commonly use email-based login.
3. If the account uses a temporary password, the app guides the user to change
   it.
4. The app logs inactive users out after 30 minutes.
5. A warning appears shortly before the inactivity timeout.
6. Logging out in one browser tab logs the user out in other tabs.

If repeated login failures lock an account, wait until the lock expires or ask
an administrator to review the account.

## Admin guide

Admin routes are under `/admin`.

### Dashboard

Path: `/admin/dashboard`

Use the dashboard for high-level academic and workflow visibility. The shared
dashboard shell can show:

- System announcements.
- Grade submissions for review.
- Grade unlock requests.
- Pending attendance access requests.

### Users

Path: `/admin/users`

Admins can manage users across all roles.

Common tasks:

- Create teacher or admin accounts.
- Create student accounts.
- Generate student usernames.
- Assign students to courses, year levels, sections, and subjects.
- Update account details.
- Change student enrollment status.
- Mark dropout accounts so they cannot sign in.
- Delete users when appropriate.

Student username generation follows this pattern:

```text
STUD-{COURSE_CODE}-{YEAR_DIGIT}{SEQUENCE}
```

Examples:

- `STUD-CS-1001`
- `STUD-OA-2001`
- `STUD-VTED-3001`

Known course-code mappings include:

- BSCS -> CS
- BSOA -> OA
- BTVTED / BTTE -> VTED

### Courses

Path: `/admin/courses`

Use this page to manage academic programs. Courses are referenced by students
and subjects.

### Subjects

Path: `/admin/subjects`

Use this page to manage subject catalog data.

Important subject fields:

- Subject name.
- Subject code.
- Course.
- Teacher assignment.
- Year level.
- Semester.
- Class days.
- Prerequisites, where supported by the UI.

Subject semester and year level influence student subject visibility, grade
entry validation, and advancement workflows.

### Sections

Path: `/admin/sections`

Use this page to manage official sections and student section assignments.

Common tasks:

- Create sections for a course and year level.
- Mark sections active or inactive.
- Assign or transfer students.
- Promote students to a new section.
- Delete sections when safe.

Section and promotion functions also update student/user year-level fields and
assignment history.

### Academic

Path: `/admin/academic`

Use this page for school-year and academic workflow administration.

Common tasks:

- Create school years.
- Set the active school year.
- Archive or delete school years where allowed.
- Publish system announcements.
- Configure grading period deadlines.

Only one school year should be active at a time. Grades are associated with the
active school year through database helpers.

Grading period deadlines lock teacher grade entry after a deadline passes.
Admins can still manage grade workflow and unlocks.

### Grades

Path: `/admin/grades`

Use this page to review grade data across teachers, subjects, semesters, and
school years.

Common tasks:

- Filter grade rows.
- Review teacher submissions.
- Approve grade rows.
- Reopen or unlock rows for correction.
- Resolve workflow alerts from the dashboard shell.

Grade workflow statuses:

- `draft`: Teacher is still editing.
- `for_review`: Teacher submitted grades for admin review.
- `approved`: Admin approved the rows.
- `reopened`: Admin reopened rows for correction.

### Attendance Access

Path: `/admin/attendance-access`

Teachers need access approval when they attempt to edit attendance on
off-schedule or locked dates. Admins can:

- View pending requests.
- Review the subject, date, teacher, and reason.
- Approve or reject the request.

Approved access is intended to be used once.

### Analytics

Path: `/admin/analytics`

Use analytics for performance summaries across courses, subjects, students, and
grade outcomes.

## Teacher guide

Teacher routes are under `/teacher`.

### Dashboard

Path: `/teacher/dashboard`

Use the dashboard for subject and grade-entry summary information. Notifications
may include:

- Grading deadline reminders.
- Pending grade disputes.
- System announcements.

### My Subjects

Path: `/teacher/subjects`

Use this page to view subjects assigned to the teacher.

Subjects are assigned by admins. If a subject is missing, confirm the admin set
the teacher assignment on the subject.

### Students

Path: `/teacher/students`

Use this page to view students enrolled in assigned subjects and inspect their
grade records.

### Grades

Path: `/teacher/grades`

This is the main grade encoding screen.

Typical workflow:

1. Select a subject.
2. Select semester.
3. Select grading period.
4. Select a student or view all enrolled students.
5. Enter a grade or mark INC.
6. Save the row.
7. Submit grades for review when finished.

Grade entry accepts either:

- Percentage values from `0` to `100`.
- Official grade-point values from `1.00` to `5.00`.

The app previews the official grade point and remarks using the institutional
grade scale.

If a grading period deadline has passed, grade entry is blocked. If rows are
locked after submission or approval, use the unlock request flow with a reason.

### Bulk grade upload

Bulk upload is available from the teacher grades workflow.

General process:

1. Prepare a spreadsheet with student and grade information.
2. Upload the file.
3. Review the validation preview.
4. Fix invalid rows if necessary.
5. Save valid rows.

The preview matches rows to enrolled students and existing grade records before
writing changes.

### Disputes

Path: `/teacher/disputes`

Students can dispute grade rows. Teachers can:

- Review pending disputes.
- See the disputed grade, student, subject, semester, and grading period.
- Accept the dispute and enter a corrected grade.
- Reject the dispute with a response.

Accepted disputes update the linked grade row. Resolved disputes create student
notifications.

### Attendance

Path: `/teacher/attendance`

Use this page to record attendance for assigned subjects.

Attendance statuses:

- Present = 100
- Late = 50
- Absent = 0

Attendance dates are controlled by:

- Subject class-day schedule.
- Attendance session type: class or no class.
- Session lock state.
- Attendance access requests.

If a date is off-schedule or locked, submit an access request to an admin with a
reason.

### Analytics

Path: `/teacher/analytics`

Use this page for teacher-level subject, grade, and student performance
analytics.

## Student guide

Student routes are under `/student`.

### Dashboard

Path: `/student/dashboard`

Use the dashboard for academic summary information, announcements, and
performance highlights.

### My Subjects

Path: `/student/subjects`

Use this page to view enrolled subjects.

The app can hide subjects that belong to a future semester or have unmet
prerequisites. Back subjects and past-term subjects can still appear when they
are relevant to the student's academic standing.

### My Schedule

Path: `/student/schedule`

Use this page to view scheduled class days for enrolled subjects.

### My Grades

Path: `/student/grades`

Use this page to view grades by school year, semester, and grading period.

This page includes:

- Grade tables.
- Academic standing guidance.
- Official grade report view.
- Grade dispute panel.
- Filters by school year, semester, year level, subject, and period.

Students can print official report views from this page.

### Grade disputes

Students can dispute a grade when they believe it is incorrect.

Typical workflow:

1. Open `/student/grades`.
2. Locate the grade.
3. Submit a dispute with a reason.
4. Wait for teacher review.
5. Review the teacher response once resolved.

Only one pending dispute is allowed for the same grade row at a time.

### Analytics

Path: `/student/analytics`

Use this page to view personal academic trends, strengths, weaknesses, and
suggestions based on available grade data.

## Academic rules visible to users

### Passing and failing

Passing means the official grade point is `3.00` or better. `5.00` is failing.
`INC` is treated as incomplete and blocks some advancement/promotion workflows.

### GWA

GWA is calculated from official subject grade points and snapped to the
institutional grade scale.

### Back subjects

A back subject is a lower-year or prior-term subject that still needs attention,
usually because the student did not pass it previously. Back subjects can remain
visible after advancement.

### Prerequisites

If a subject has prerequisites, the student must pass the prerequisite subject
before the dependent subject is considered available.

### Current semester

Students have a current semester value:

- `1`: first semester
- `2`: second semester

This controls which catalog-semester subjects appear in current student views.

## Notification types

Depending on role, the dashboard shell may show notifications for:

- System announcements.
- Admin grade workflow alerts.
- Attendance access requests.
- Teacher deadline reminders.
- Teacher pending disputes.
- Student dispute resolutions.

Some notification read states are stored locally in the browser.
