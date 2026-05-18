-- Lock attendance after save; admin-approved access for off-schedule or locked dates.

alter table public.attendance_sessions
  add column if not exists is_locked boolean not null default false,
  add column if not exists locked_at timestamptz;

create table if not exists public.attendance_access_requests (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  attendance_date date not null,
  requested_by uuid references public.users (id) on delete set null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_attendance_access_pending_unique
  on public.attendance_access_requests (subject_id, attendance_date)
  where status = 'pending';

create index if not exists idx_attendance_access_requests_status
  on public.attendance_access_requests (status, created_at desc);

drop trigger if exists trg_set_attendance_access_requests_updated_at on public.attendance_access_requests;

create trigger trg_set_attendance_access_requests_updated_at
before update on public.attendance_access_requests
for each row
execute procedure public.set_attendance_updated_at();

alter table public.attendance_access_requests enable row level security;

drop policy if exists attendance_access_requests_select on public.attendance_access_requests;
drop policy if exists attendance_access_requests_insert on public.attendance_access_requests;
drop policy if exists attendance_access_requests_update on public.attendance_access_requests;
drop policy if exists attendance_access_requests_delete on public.attendance_access_requests;

create policy attendance_access_requests_select
on public.attendance_access_requests
for select
to anon, authenticated
using (true);

create policy attendance_access_requests_insert
on public.attendance_access_requests
for insert
to anon, authenticated
with check (true);

create policy attendance_access_requests_update
on public.attendance_access_requests
for update
to anon, authenticated
using (true)
with check (true);

create policy attendance_access_requests_delete
on public.attendance_access_requests
for delete
to anon, authenticated
using (true);
