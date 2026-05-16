-- Align grade.semester (1|2) with subjects.semester ('1st Sem'|'2nd Sem').
-- Fixes legacy mismatches, then blocks new mismatches at insert/update.

update public.grades g
set semester = case
  when s.semester ilike '%2%' or lower(trim(s.semester)) like '2nd%' then 2
  when s.semester ilike '%1%' or lower(trim(s.semester)) like '1st%' then 1
  else g.semester
end
from public.subjects s
where g.subject_id = s.id
  and s.semester is not null
  and (
    ((s.semester ilike '%1%' or lower(trim(s.semester)) like '1st%') and g.semester is distinct from 1)
    or ((s.semester ilike '%2%' or lower(trim(s.semester)) like '2nd%') and g.semester is distinct from 2)
  );

create or replace function public.enforce_grade_subject_semester()
returns trigger
language plpgsql
as $$
declare
  subj_sem text;
  expected smallint;
begin
  select semester into subj_sem
  from public.subjects
  where id = new.subject_id;

  if subj_sem is null or trim(subj_sem) = '' then
    return new;
  end if;

  if subj_sem ilike '%2%' or lower(trim(subj_sem)) like '2nd%' then
    expected := 2;
  elsif subj_sem ilike '%1%' or lower(trim(subj_sem)) like '1st%' then
    expected := 1;
  else
    return new;
  end if;

  if new.semester is distinct from expected then
    raise exception
      'Grade semester (%) does not match subject catalog semester (%). Use semester % for this subject.',
      new.semester, subj_sem, expected;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_grade_subject_semester on public.grades;
create trigger trg_enforce_grade_subject_semester
before insert or update on public.grades
for each row
execute function public.enforce_grade_subject_semester();
