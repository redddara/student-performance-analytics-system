-- Grading period submission deadlines (Prelims, Midterms, Semi-Finals, Finals).
-- After deadline_at, teachers cannot enter or edit grades for that period; existing rows are auto-locked.

create table if not exists public.grading_period_deadlines (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references public.school_years (id) on delete cascade,
  semester smallint not null,
  period smallint not null,
  deadline_at timestamptz not null,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_year_id, semester, period),
  check (semester in (1, 2)),
  check (period in (1, 2, 3, 4))
);

create index if not exists idx_grading_period_deadlines_lookup
  on public.grading_period_deadlines (school_year_id, semester, period, deadline_at);

-- Lock all grade rows for periods whose deadline has passed.
create or replace function public.apply_grading_period_deadline_locks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_count integer;
begin
  with due as (
    select school_year_id, semester, period
    from public.grading_period_deadlines
    where deadline_at <= now()
  )
  update public.grades g
  set
    is_locked = true,
    locked_at = coalesce(g.locked_at, now()),
    workflow_status = case
      when g.workflow_status = 'draft' then 'for_review'
      else g.workflow_status
    end
  from due d
  where g.school_year_id = d.school_year_id
    and g.semester = d.semester
    and g.quarter = d.period
    and not g.is_locked;

  get diagnostics locked_count = row_count;
  return locked_count;
end;
$$;

-- True when a deadline for this scope has passed (blocks teacher entry even with no grade rows).
create or replace function public.grading_period_is_closed(
  p_school_year_id uuid,
  p_semester smallint,
  p_period smallint
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.grading_period_deadlines d
    where d.school_year_id = p_school_year_id
      and d.semester = p_semester
      and d.period = p_period
      and d.deadline_at <= now()
  );
$$;

-- Block teacher grade writes after the period deadline (admins may still edit via app).
create or replace function public.grades_enforce_period_deadline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sy_id uuid;
begin
  sy_id := coalesce(new.school_year_id, old.school_year_id);
  if sy_id is null then
    select id into sy_id from public.school_years where is_active = true limit 1;
  end if;

  if sy_id is not null
    and public.grading_period_is_closed(sy_id, new.semester, new.quarter) then
    raise exception 'Grading period is closed. The submission deadline for this period has passed.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- Block new grade rows after deadline; updates use is_locked + admin unlock workflow.
drop trigger if exists grades_enforce_period_deadline_trigger on public.grades;
create trigger grades_enforce_period_deadline_trigger
  before insert on public.grades
  for each row
  execute function public.grades_enforce_period_deadline();

alter table if exists public.grading_period_deadlines enable row level security;

drop policy if exists grading_period_deadlines_select_policy on public.grading_period_deadlines;
drop policy if exists grading_period_deadlines_insert_policy on public.grading_period_deadlines;
drop policy if exists grading_period_deadlines_update_policy on public.grading_period_deadlines;
drop policy if exists grading_period_deadlines_delete_policy on public.grading_period_deadlines;

create policy grading_period_deadlines_select_policy
on public.grading_period_deadlines
for select
to anon, authenticated
using (true);

create policy grading_period_deadlines_insert_policy
on public.grading_period_deadlines
for insert
to anon, authenticated
with check (true);

create policy grading_period_deadlines_update_policy
on public.grading_period_deadlines
for update
to anon, authenticated
using (true)
with check (true);

create policy grading_period_deadlines_delete_policy
on public.grading_period_deadlines
for delete
to anon, authenticated
using (true);

grant execute on function public.apply_grading_period_deadline_locks() to anon, authenticated;
grant execute on function public.grading_period_is_closed(uuid, smallint, smallint) to anon, authenticated;
