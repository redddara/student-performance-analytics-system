# Local setup and deployment

This guide covers local development, production builds, static serving, and
platform deployment notes for SAPAS.

## Prerequisites

- Node.js 20 or newer.
- npm.
- Supabase project access.
- Supabase CLI if you need to apply migrations or deploy edge functions from
  the command line.
- Brevo account and verified sender if email delivery is needed.

## Install dependencies

From the repository root:

```bash
npm ci
```

Use `npm install` only when intentionally changing dependencies.

## Configure environment

Create a local env file:

```bash
cp .env.example .env
```

Fill in:

```bash
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
VITE_APP_URL="http://localhost:5173"
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are required by
`src/lib/supabase.ts`. The app throws during startup if either value is empty.

`VITE_APP_URL` is optional and is used when generating login links in email
templates. If it is not set, the client falls back to `window.location.origin`.

Do not commit `.env` files with real credentials.

## Start the development server

```bash
npm run dev
```

Vite prints the local URL, usually `http://localhost:5173`.

The Vite dev server applies anti-clickjacking headers from `vite.config.ts`:

- `X-Frame-Options: DENY`
- `Content-Security-Policy: frame-ancestors 'none'`

## Type checking

```bash
npm run typecheck
```

The TypeScript configuration is strict and includes only `src/`.

## Production build

```bash
npm run build
```

The build output is written to `dist/`. Vite uses manual chunks for:

- React, React Router, and Zustand in `vendor`.
- Recharts in `charts`.
- Lucide, clsx, Tailwind-related packages, and xlsx in `ui-vendor`.

Source maps are disabled for production builds.

## Production static server

```bash
npm start
```

`server.js` starts an Express server that:

- Serves static files from `dist/`.
- Disables `X-Powered-By`.
- Adds anti-clickjacking headers.
- Serves `dist/index.html` for all non-file routes so React Router routes work
  on refresh.

The server listens on `PORT`, defaulting to `3000`.

```bash
PORT=8080 npm start
```

## Preview the production build with Vite

```bash
npm run preview
```

This serves the already-built app through Vite preview and uses the same
anti-clickjacking headers configured for development.

## Supabase setup

The app depends on Supabase for:

- Authentication.
- Postgres tables and RPC functions.
- RLS policies.
- Realtime subscriptions.
- Edge Function email delivery.

Apply the SQL migrations in `supabase/migrations` to the target project. See
[Supabase database and edge functions](SUPABASE.md) for schema notes and common
commands.

## Email setup

The email client in `src/api/email.ts` calls:

```text
{VITE_SUPABASE_URL}/functions/v1/send-email
```

Deploy `supabase/functions/send-email` and set these Supabase secrets:

```bash
BREVO_API_KEY="your-brevo-api-key"
EMAIL_FROM="SAPAS <verified-sender@example.com>"
```

`EMAIL_FROM` must be a Brevo-verified sender.

## Render deployment

`render.yaml` contains a minimal web service template:

```yaml
services:
  - type: web
    name: your-app-name
    env: node
    buildCommand: npm ci && npm run build
    startCommand: npm start
```

Set the required Vite environment variables in Render before building:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_URL`

Set `VITE_APP_URL` to the public Render URL so outgoing emails contain correct
links.

## Vercel and static hosting

`vercel.json` currently configures only security headers. If hosting the app as
a static Vite site on Vercel or another static host, make sure SPA fallback is
configured so all application routes serve `index.html`.

`public/_headers` provides equivalent frame-protection headers for static hosts
that understand Netlify/Cloudflare-style header files.

## Deployment checklist

1. Install dependencies with `npm ci`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Set `VITE_APP_URL` to the public app URL.
4. Apply required Supabase migrations.
5. Deploy `send-email` if account creation or password reset emails are needed.
6. Set `BREVO_API_KEY` and `EMAIL_FROM` Supabase secrets.
7. Run `npm run build`.
8. Serve with `npm start` or configure equivalent static hosting with SPA
   fallback.
9. Smoke test login, role redirects, grade views, and email flows.

## Common setup problems

### App fails immediately on load

Check for missing or empty Supabase environment variables. The Supabase client
is created at module load and requires both values.

### Emails return HTTP 503

The edge function is deployed but one or more required secrets are missing.
Check `BREVO_API_KEY` and `EMAIL_FROM`.

### Emails return HTTP 502

The Brevo API rejected the request. Check the API key, sender verification, and
Brevo account status.

### Refreshing a dashboard URL returns 404

The production host is not configured for SPA fallback. Use `server.js` or add a
rewrite rule from all routes to `index.html`.

### Grade, attendance, or academic pages show database errors

Apply the latest migrations in `supabase/migrations` to the target Supabase
project. These pages rely on recent tables, columns, RLS policies, and
functions.
