# Student Performance Analytics System

Student Performance Analytics System (SAPAS), branded in the UI as
Edulytics PHILTECH, is a role-based academic management and analytics
application for administrators, teachers, and students. The app tracks users,
courses, sections, subjects, grades, attendance, school years, semester
advancement, grade disputes, and student performance insights.

The frontend is a React single-page application built with Vite and
TypeScript. Data, authentication, row-level access rules, and email delivery
are handled through Supabase.

## Documentation index

- [Local setup and deployment](docs/SETUP.md)
- [Architecture and code map](docs/ARCHITECTURE.md)
- [Supabase database and edge functions](docs/SUPABASE.md)
- [User guide](docs/USER_GUIDE.md)
- [Development guide](docs/DEVELOPMENT.md)

## Main capabilities

### Admin

- Manage users for admin, teacher, and student roles.
- Manage courses, subjects, class schedules, official sections, and section
  assignments.
- Create and activate school years.
- Configure grading period deadlines.
- Review submitted grades and unlock requests.
- Approve or reject teacher attendance access requests.
- Advance students through semesters and year levels.
- View dashboards and analytics across courses, subjects, and students.
- Publish system announcements.

### Teacher

- View assigned subjects and enrolled students.
- Encode grades per subject, semester, and grading period.
- Upload bulk grades from spreadsheets.
- Submit grades for admin review.
- Request grade unlocks after review or deadline locks.
- Record attendance by scheduled class day and grading period.
- Request attendance access for off-schedule or locked dates.
- Review and resolve student grade disputes.
- View teacher-level performance analytics.

### Student

- View enrolled subjects and class schedule.
- View grades by school year, semester, and grading period.
- Print official grade report views.
- Submit grade disputes for teacher review.
- See academic standing, back subjects, and prerequisite-related guidance.
- View student performance analytics and trends.

## Tech stack

| Area | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite 7 |
| Routing | React Router v6 |
| State | Zustand |
| Styling | Tailwind CSS, custom maroon/gold theme |
| Charts | Recharts |
| Icons | Lucide React, Hugeicons web font |
| Data and auth | Supabase Postgres, Auth, RLS, Realtime |
| Email | Supabase Edge Function with Brevo SMTP API |
| Spreadsheet import | `xlsx` |
| Production server | Express serving the Vite build output |

## Repository layout

```text
.
├── api/                         # Reserved API directory
├── dist/                        # Built Vite output checked into the repo
├── docs/                        # Project documentation
├── public/                      # Static public assets and headers
├── src/
│   ├── api/                     # Client-side API wrappers
│   ├── assets/                  # Images and app assets
│   ├── components/              # Layouts, UI primitives, student panels
│   ├── constants/               # School/section constants
│   ├── lib/                     # Domain logic and Supabase helpers
│   ├── pages/                   # Route pages by role
│   ├── store/                   # Zustand stores
│   └── types/                   # Shared TypeScript types
├── supabase/
│   ├── functions/send-email/    # Deno edge function for email delivery
│   ├── migrations/              # SQL migrations for app features
│   └── config.toml              # Supabase CLI function config
├── index.html                   # Vite HTML shell
├── package.json                 # Scripts and dependencies
├── server.js                    # Express static server for production
├── render.yaml                  # Render deployment template
├── vercel.json                  # Security header config
└── vite.config.ts               # Vite build/dev config
```

## Quick start

Prerequisites:

- Node.js 20 or newer is recommended for Vite 7.
- npm.
- A Supabase project with the required schema and edge function secrets.

Setup:

```bash
npm ci
cp .env.example .env
```

Set these values in `.env`:

```bash
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
VITE_APP_URL="http://localhost:5173"
```

Run the app:

```bash
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:5173`.

For a production-style local run:

```bash
npm run build
npm start
```

The Express server listens on `PORT` or `3000` by default.

## npm scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `npm run dev` | `vite` | Start the local Vite dev server |
| `npm run build` | `vite build` | Build production assets into `dist/` |
| `npm start` | `node server.js` | Serve `dist/` with Express |
| `npm run preview` | `vite preview` | Preview the production build with Vite |
| `npm run typecheck` | `tsc --noEmit` | Run TypeScript checks |

No automated test runner is currently configured.

## Environment variables

### Frontend build-time variables

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/publishable key |
| `VITE_APP_URL` | No | Public app URL used in email links; falls back to the browser origin |

### Node runtime variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PORT` | No | `3000` | Port used by `server.js` |

### Supabase Edge Function secrets

| Secret | Required | Description |
| --- | --- | --- |
| `BREVO_API_KEY` | Yes | Brevo API key for SMTP email sending |
| `EMAIL_FROM` | Yes | Verified sender, for example `SAPAS <noreply@example.com>` |

## Application routes

Authentication routes:

- `/login`
- `/change-password`
- `/forgot-password`
- `/reset-password`

Admin routes:

- `/admin/dashboard`
- `/admin/grades`
- `/admin/users`
- `/admin/courses`
- `/admin/subjects`
- `/admin/attendance-access`
- `/admin/sections`
- `/admin/academic`
- `/admin/analytics`

Teacher routes:

- `/teacher/dashboard`
- `/teacher/subjects`
- `/teacher/grades`
- `/teacher/disputes`
- `/teacher/students`
- `/teacher/attendance`
- `/teacher/analytics`

Student routes:

- `/student/dashboard`
- `/student/subjects`
- `/student/schedule`
- `/student/grades`
- `/student/analytics`

Routes are protected by role. Users are redirected to the dashboard for their
role when they attempt to access a route outside their role.

## Data model summary

The app expects Supabase tables for:

- `users`
- `students`
- `courses`
- `subjects`
- `student_subjects`
- `grades`
- `school_years`
- `sections`
- `student_section_assignments`
- `subject_prerequisites`
- `grade_disputes`
- `attendance_records`
- `attendance_sessions`
- `attendance_access_requests`
- `grading_period_deadlines`
- `system_announcements`
- `student_academic_history`

See [Supabase database and edge functions](docs/SUPABASE.md) for more detail.

## Security and access notes

- Supabase Auth is used for sessions.
- Application route access is enforced client-side by role.
- Database access should be enforced with Supabase RLS policies.
- The app implements inactivity logout after 30 minutes, with a warning before
  expiration.
- Logout is synchronized across tabs with local storage events.
- Login lockout is supported after repeated failed attempts.
- Student accounts marked as dropout are blocked from login.
- The app sets anti-clickjacking headers for Vite dev/preview, Express
  production serving, Vercel, and public static header files.

## Deployment overview

The standard deployment flow is:

```bash
npm ci
npm run build
npm start
```

`server.js` serves the `dist/` directory and falls back to `index.html` for SPA
routes. `render.yaml` contains a Render web service template using that flow.

Supabase migrations and the `send-email` edge function are deployed separately
with the Supabase CLI or the Supabase dashboard.

## Troubleshooting

### Missing Supabase environment values

If startup fails with a message about `VITE_SUPABASE_URL` or
`VITE_SUPABASE_ANON_KEY`, copy `.env.example` to `.env` and fill in the values
from Supabase project settings.

### Email fails to send

Confirm the `send-email` edge function is deployed and that `BREVO_API_KEY` and
`EMAIL_FROM` are configured as Supabase secrets.

### Grade or attendance features fail after deployment

Apply the SQL migrations in `supabase/migrations` to the target Supabase
project. Several UI features depend on columns, tables, functions, or policies
added by these migrations.

### Production routes return 404

Use `npm start` or a hosting platform with SPA fallback configured. Direct
requests such as `/admin/dashboard` must resolve to `dist/index.html`.
