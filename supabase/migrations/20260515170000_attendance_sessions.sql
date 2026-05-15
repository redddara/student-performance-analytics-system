-- Per-subject, per-date session type: regular class or no class.
create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  attendance_date date not null,
  session_type text not null default 'class' check (session_type in ('class', 'no_class')),
  marked_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_id, attendance_date)
);

create index if not exists idx_attendance_sessions_subject_date
  on public.attendance_sessions (subject_id, attendance_date);

drop trigger if exists trg_set_attendance_sessions_updated_at on public.attendance_sessions;

create trigger trg_set_attendance_sessions_updated_at
before update on public.attendance_sessions
for each row
execute procedure public.set_attendance_updated_at();

alter table public.attendance_sessions enable row level security;

drop policy if exists attendance_sessions_select_policy on public.attendance_sessions;
drop policy if exists attendance_sessions_insert_policy on public.attendance_sessions;
drop policy if exists attendance_sessions_update_policy on public.attendance_sessions;
drop policy if exists attendance_sessions_delete_policy on public.attendance_sessions;

create policy attendance_sessions_select_policy
on public.attendance_sessions
for select
to authenticated
using (
  exists (
    select 1
    from public.subjects s
    where s.id = attendance_sessions.subject_id
      and (
        s.teacher_id = auth.uid()
        or exists (
          select 1 from public.users u
          where u.id = auth.uid() and u.role = 'admin'
        )
      )
  )
);

create policy attendance_sessions_insert_policy
on public.attendance_sessions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.subjects s
    where s.id = attendance_sessions.subject_id
      and (
        s.teacher_id = auth.uid()
        or exists (
          select 1 from public.users u
          where u.id = auth.uid() and u.role = 'admin'
        )
      )
  )
  and (attendance_sessions.marked_by is null or attendance_sessions.marked_by = auth.uid())
);

create policy attendance_sessions_update_policy
on public.attendance_sessions
for update
to authenticated
using (
  exists (
    select 1
    from public.subjects s
    where s.id = attendance_sessions.subject_id
      and (
        s.teacher_id = auth.uid()
        or exists (
          select 1 from public.users u
          where u.id = auth.uid() and u.role = 'admin'
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.subjects s
    where s.id = attendance_sessions.subject_id
      and (
        s.teacher_id = auth.uid()
        or exists (
          select 1 from public.users u
          where u.id = auth.uid() and u.role = 'admin'
        )
      )
  )
  and (attendance_sessions.marked_by is null or attendance_sessions.marked_by = auth.uid())
);

create policy attendance_sessions_delete_policy
on public.attendance_sessions
for delete
to authenticated
using (
  exists (
    select 1
    from public.subjects s
    where s.id = attendance_sessions.subject_id
      and (
        s.teacher_id = auth.uid()
        or exists (
          select 1 from public.users u
          where u.id = auth.uid() and u.role = 'admin'
        )
      )
  )
);
