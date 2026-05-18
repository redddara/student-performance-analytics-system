-- Grade dispute / appeal workflow: RLS, indexes, audit columns.

alter table if exists public.grade_disputes
  add column if not exists disputed_grade numeric(5,2),
  add column if not exists corrected_grade numeric(5,2),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_grade_disputes_student_status
  on public.grade_disputes (student_id, status, created_at desc);

create index if not exists idx_grade_disputes_teacher_status
  on public.grade_disputes (teacher_id, status, created_at desc)
  where teacher_id is not null;

create index if not exists idx_grade_disputes_grade_id
  on public.grade_disputes (grade_id, created_at desc);

-- One open dispute per grade row at a time.
create unique index if not exists uq_grade_disputes_one_pending_per_grade
  on public.grade_disputes (grade_id)
  where status = 'pending';

create or replace function public.grade_disputes_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists grade_disputes_touch_updated_at on public.grade_disputes;
create trigger grade_disputes_touch_updated_at
  before update on public.grade_disputes
  for each row
  execute function public.grade_disputes_touch_updated_at();

alter table if exists public.grade_disputes enable row level security;

drop policy if exists grade_disputes_select_policy on public.grade_disputes;
drop policy if exists grade_disputes_insert_policy on public.grade_disputes;
drop policy if exists grade_disputes_update_policy on public.grade_disputes;
drop policy if exists grade_disputes_delete_policy on public.grade_disputes;

create policy grade_disputes_select_policy
on public.grade_disputes
for select
to anon, authenticated
using (true);

create policy grade_disputes_insert_policy
on public.grade_disputes
for insert
to anon, authenticated
with check (true);

create policy grade_disputes_update_policy
on public.grade_disputes
for update
to anon, authenticated
using (true)
with check (true);

create policy grade_disputes_delete_policy
on public.grade_disputes
for delete
to anon, authenticated
using (true);
