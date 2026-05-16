-- Fix semester advance: use final subject standing (active school year), not any failed quarter
-- or ungraded enrollments from prior years.

create or replace function public.grade_row_display_percent(p_grade numeric)
returns numeric
language sql
immutable
as $$
  select case
    when p_grade is null then null::numeric
    when p_grade > 5 then round(p_grade)
    when p_grade <= 1.0 then 99::numeric
    when p_grade <= 1.25 then 96::numeric
    when p_grade <= 1.5 then 93::numeric
    when p_grade <= 1.75 then 90::numeric
    when p_grade <= 2.0 then 87::numeric
    when p_grade <= 2.25 then 84::numeric
    when p_grade <= 2.5 then 81::numeric
    when p_grade <= 2.75 then 78::numeric
    when p_grade <= 3.0 then 76::numeric
    else 70::numeric
  end
$$;

create or replace function public.subject_final_percent_from_grades(
  p_student_id uuid,
  p_subject_id uuid
)
returns numeric
language plpgsql
stable
as $$
declare
  active_sy uuid;
  r record;
  total numeric := 0;
  n int := 0;
  p numeric;
begin
  if p_student_id is null or p_subject_id is null then
    return null;
  end if;

  active_sy := public._active_school_year_id();

  for r in
    select g.grade, g.grade_status
    from public.grades g
    where g.student_id = p_student_id
      and g.subject_id = p_subject_id
      and g.grade_status is distinct from 'inc'
      and g.grade is not null
      and (
        active_sy is null
        or g.school_year_id = active_sy
      )
  loop
    p := public.grade_row_display_percent(r.grade);
    if p is not null then
      total := total + p;
      n := n + 1;
    end if;
  end loop;

  if n = 0 then
    return null;
  end if;

  return round((total / n)::numeric, 2);
end;
$$;

create or replace function public.student_passed_subject(
  p_student_id uuid,
  p_subject_id uuid,
  p_minimum_grade numeric default 75
)
returns boolean
language plpgsql
stable
as $$
declare
  active_sy uuid;
  has_inc boolean;
  final_percent numeric;
begin
  if p_student_id is null or p_subject_id is null then
    return false;
  end if;

  active_sy := public._active_school_year_id();

  select exists (
    select 1
    from public.grades g
    where g.student_id = p_student_id
      and g.subject_id = p_subject_id
      and g.grade_status = 'inc'
      and (active_sy is null or g.school_year_id = active_sy)
  ) into has_inc;

  if has_inc then
    return false;
  end if;

  final_percent := public.subject_final_percent_from_grades(p_student_id, p_subject_id);

  if final_percent is null then
    return false;
  end if;

  return final_percent >= coalesce(p_minimum_grade, 75);
end;
$$;

create or replace function public.student_can_advance_to_second_semester(p_student_id uuid)
returns boolean
language plpgsql
stable
as $$
declare
  st record;
  active_sy uuid;
begin
  if p_student_id is null then
    return false;
  end if;

  select id, course_id, grade_level, current_semester
  into st
  from public.students
  where id = p_student_id;

  if not found then
    return false;
  end if;

  if coalesce(st.current_semester, 1) >= 2 then
    return false;
  end if;

  if st.course_id is null or st.grade_level is null then
    return false;
  end if;

  active_sy := public._active_school_year_id();

  -- Only 1st-semester subjects with grades in the active school year must have a passing final standing.
  if exists (
    select 1
    from public.subjects sub
    where sub.course_id = st.course_id
      and sub.year_level = st.grade_level
      and public.subject_catalog_semester_number(sub.semester) = 1
      and exists (
        select 1
        from public.grades g
        where g.student_id = p_student_id
          and g.subject_id = sub.id
          and (active_sy is null or g.school_year_id = active_sy)
      )
      and not public.student_passed_subject(p_student_id, sub.id)
  ) then
    return false;
  end if;

  return true;
end;
$$;
