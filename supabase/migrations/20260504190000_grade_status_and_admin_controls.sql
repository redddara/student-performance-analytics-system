-- Grade status support + safer defaults for INC handling.
-- Apply with Supabase migration flow (`supabase db push`) or SQL editor.

alter table public.grades
  add column if not exists grade_status text not null default 'failed';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'grades_grade_status_check'
  ) then
    alter table public.grades
      add constraint grades_grade_status_check check (grade_status in ('failed', 'inc', 'passed'));
  end if;
end $$;

update public.grades
set grade_status = case
  when coalesce(remarks, '') ilike 'INC%' then 'inc'
  when coalesce(grade, 0) >= 75 then 'passed'
  else 'failed'
end
where grade_status is distinct from case
  when coalesce(remarks, '') ilike 'INC%' then 'inc'
  when coalesce(grade, 0) >= 75 then 'passed'
  else 'failed'
end;
