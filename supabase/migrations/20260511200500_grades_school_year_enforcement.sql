-- Enforce School Year assignment for grades.
-- Goal: prevent "data mess" across years by ensuring every grade has school_year_id.
-- Strategy:
-- 1) Backfill legacy grade rows (school_year_id is null) into the currently active school year.
-- 2) Add a trigger to auto-assign active school year on INSERT/UPDATE when school_year_id is null.

create or replace function public._active_school_year_id()
returns uuid
language sql
stable
as $$
  select id
  from public.school_years
  where is_active = true
  limit 1
$$;

create or replace function public.set_grades_school_year_id()
returns trigger
language plpgsql
as $$
declare
  sy_id uuid;
begin
  if new.school_year_id is not null then
    return new;
  end if;

  sy_id := public._active_school_year_id();

  if sy_id is null then
    raise exception 'No active school year found. Create/activate a row in public.school_years before inserting grades.';
  end if;

  new.school_year_id := sy_id;
  return new;
end;
$$;

drop trigger if exists trg_set_grades_school_year_id on public.grades;
create trigger trg_set_grades_school_year_id
before insert or update on public.grades
for each row
execute function public.set_grades_school_year_id();

-- Backfill legacy rows to the active school year.
-- If you want a more precise backfill (by created_at between starts_on/ends_on),
-- we can extend this once school_years.starts_on/ends_on are consistently populated.
update public.grades
set school_year_id = public._active_school_year_id()
where school_year_id is null;

