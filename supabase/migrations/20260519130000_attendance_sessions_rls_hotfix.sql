-- Hotfix: attendance_sessions RLS blocked teacher saves (upsert / no-class).
-- Matches attendance_records hotfix — app sessions may not map public.users.id to auth.uid().

alter table public.attendance_sessions enable row level security;

drop policy if exists attendance_sessions_select_policy on public.attendance_sessions;
drop policy if exists attendance_sessions_insert_policy on public.attendance_sessions;
drop policy if exists attendance_sessions_update_policy on public.attendance_sessions;
drop policy if exists attendance_sessions_delete_policy on public.attendance_sessions;

create policy attendance_sessions_select_policy
on public.attendance_sessions
for select
to anon, authenticated
using (true);

create policy attendance_sessions_insert_policy
on public.attendance_sessions
for insert
to anon, authenticated
with check (true);

create policy attendance_sessions_update_policy
on public.attendance_sessions
for update
to anon, authenticated
using (true)
with check (true);

create policy attendance_sessions_delete_policy
on public.attendance_sessions
for delete
to anon, authenticated
using (true);
