-- Allow app clients to read and manage subject prerequisites.
-- Matches permissive RLS used for school_years, attendance_records, etc.

alter table if exists public.subject_prerequisites enable row level security;

drop policy if exists subject_prerequisites_select_policy on public.subject_prerequisites;
drop policy if exists subject_prerequisites_insert_policy on public.subject_prerequisites;
drop policy if exists subject_prerequisites_update_policy on public.subject_prerequisites;
drop policy if exists subject_prerequisites_delete_policy on public.subject_prerequisites;

create policy subject_prerequisites_select_policy
on public.subject_prerequisites
for select
to anon, authenticated
using (true);

create policy subject_prerequisites_insert_policy
on public.subject_prerequisites
for insert
to anon, authenticated
with check (true);

create policy subject_prerequisites_update_policy
on public.subject_prerequisites
for update
to anon, authenticated
using (true)
with check (true);

create policy subject_prerequisites_delete_policy
on public.subject_prerequisites
for delete
to anon, authenticated
using (true);
