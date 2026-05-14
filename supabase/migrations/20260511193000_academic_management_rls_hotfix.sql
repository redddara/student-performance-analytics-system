-- Hotfix for Academic Management actions blocked by RLS.
-- Current app auth/profile flow may not map public.users.id to auth.uid(),
-- so we use permissive policies consistent with existing attendance hotfix.

alter table if exists public.school_years enable row level security;
alter table if exists public.system_announcements enable row level security;

drop policy if exists school_years_select_policy on public.school_years;
drop policy if exists school_years_insert_policy on public.school_years;
drop policy if exists school_years_update_policy on public.school_years;
drop policy if exists school_years_delete_policy on public.school_years;

drop policy if exists system_announcements_select_policy on public.system_announcements;
drop policy if exists system_announcements_insert_policy on public.system_announcements;
drop policy if exists system_announcements_update_policy on public.system_announcements;
drop policy if exists system_announcements_delete_policy on public.system_announcements;

create policy school_years_select_policy
on public.school_years
for select
to anon, authenticated
using (true);

create policy school_years_insert_policy
on public.school_years
for insert
to anon, authenticated
with check (true);

create policy school_years_update_policy
on public.school_years
for update
to anon, authenticated
using (true)
with check (true);

create policy school_years_delete_policy
on public.school_years
for delete
to anon, authenticated
using (true);

create policy system_announcements_select_policy
on public.system_announcements
for select
to anon, authenticated
using (true);

create policy system_announcements_insert_policy
on public.system_announcements
for insert
to anon, authenticated
with check (true);

create policy system_announcements_update_policy
on public.system_announcements
for update
to anon, authenticated
using (true)
with check (true);

create policy system_announcements_delete_policy
on public.system_announcements
for delete
to anon, authenticated
using (true);
