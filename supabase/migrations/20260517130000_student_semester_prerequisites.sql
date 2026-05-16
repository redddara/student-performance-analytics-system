-- Per-student academic semester + prerequisite enforcement for enrollment.

alter table public.students
  add column if not exists current_semester smallint not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'students_current_semester_check'
  ) then
    alter table public.students
      add constraint students_current_semester_check
      check (current_semester in (1, 2));
  end if;
end $$;

create or replace function public.subject_catalog_semester_number(p_semester text)
returns smallint
language sql
immutable
as $$
  select case
    when p_semester ilike '%2%' or lower(trim(p_semester)) like '2nd%' then 2::smallint
    when p_semester ilike '%1%' or lower(trim(p_semester)) like '1st%' then 1::smallint
    else null::smallint
  end
$$;

-- True when the student has a passing final standing for the subject (grade-point scale).
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
  has_failed boolean;
  has_inc boolean;
  avg_grade numeric;
  passing_gp numeric := 3.0;
begin
  if p_student_id is null or p_subject_id is null then
    return false;
  end if;

  select exists (
    select 1 from public.grades g
    where g.student_id = p_student_id
      and g.subject_id = p_subject_id
      and g.grade_status = 'failed'
  ) into has_failed;

  if has_failed then
    return false;
  end if;

  select exists (
    select 1 from public.grades g
    where g.student_id = p_student_id
      and g.subject_id = p_subject_id
      and g.grade_status = 'inc'
  ) into has_inc;

  if has_inc then
    return false;
  end if;

  select avg(g.grade)::numeric
  into avg_grade
  from public.grades g
  where g.student_id = p_student_id
    and g.subject_id = p_subject_id
    and g.grade_status is distinct from 'inc'
    and g.grade is not null;

  if avg_grade is null then
    return false;
  end if;

  -- Stored values may be percentage (>5) or grade points (<=5).
  if avg_grade > 5 then
    return avg_grade >= coalesce(p_minimum_grade, 75);
  end if;

  return avg_grade <= passing_gp and avg_grade <> 5.0;
end;
$$;

create or replace function public.student_prerequisites_met(p_student_id uuid, p_subject_id uuid)
returns boolean
language plpgsql
stable
as $$
declare
  prereq record;
begin
  if p_student_id is null or p_subject_id is null then
    return true;
  end if;

  for prereq in
    select sp.prerequisite_subject_id, sp.minimum_grade
    from public.subject_prerequisites sp
    where sp.subject_id = p_subject_id
  loop
    if not public.student_passed_subject(
      p_student_id,
      prereq.prerequisite_subject_id,
      prereq.minimum_grade
    ) then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

-- Advance selected students to 2nd semester and enroll eligible 2nd-sem subjects.
create or replace function public.advance_students_to_second_semester(p_student_ids uuid[])
returns integer
language plpgsql
as $$
declare
  affected int := 0;
begin
  if p_student_ids is null or array_length(p_student_ids, 1) is null then
    return 0;
  end if;

  update public.students st
  set current_semester = 2
  where st.id = any(p_student_ids);

  get diagnostics affected = row_count;

  if to_regclass('public.student_subjects') is not null and to_regclass('public.subjects') is not null then
    insert into public.student_subjects (student_id, subject_id)
    select st.id, sub.id
    from public.students st
    join public.subjects sub
      on sub.course_id = st.course_id
     and sub.year_level = st.grade_level
     and public.subject_catalog_semester_number(sub.semester) = 2
    where st.id = any(p_student_ids)
      and st.course_id is not null
      and public.student_prerequisites_met(st.id, sub.id)
    on conflict (student_id, subject_id) do nothing;
  end if;

  return affected;
end;
$$;

-- Promotion: start new year at 1st semester; enroll 1st-sem subjects + failed back subjects only.
create or replace function public.promote_students(
  p_student_ids uuid[],
  p_to_section_id uuid default null,
  p_school_year_id uuid default null
)
returns integer
language plpgsql
as $$
declare
  affected int := 0;
  effective_sy uuid;
  inc_count int := 0;
begin
  if p_student_ids is null or array_length(p_student_ids, 1) is null then
    return 0;
  end if;

  select count(distinct g.student_id)
  into inc_count
  from public.grades g
  where g.student_id = any(p_student_ids)
    and g.grade_status = 'inc';

  if coalesce(inc_count, 0) > 0 then
    raise exception 'Promotion blocked: % selected student(s) still have INC grades.', inc_count;
  end if;

  effective_sy := p_school_year_id;
  if effective_sy is null then
    effective_sy := public._active_school_year_id();
  end if;

  update public.students st
  set
    grade_level = public._next_year_level(st.grade_level),
    current_semester = 1
  where st.id = any(p_student_ids);

  get diagnostics affected = row_count;

  update public.users u
  set year_level = public._next_year_level(u.year_level)
  from public.students st
  where st.id = any(p_student_ids)
    and st.user_id = u.id;

  if p_to_section_id is null then
    update public.students st
    set section = public._bump_section_code(st.section, st.grade_level)
    where st.id = any(p_student_ids);

    update public.users u
    set section = public._bump_section_code(u.section, u.year_level)
    from public.students st
    where st.id = any(p_student_ids)
      and st.user_id = u.id;
  end if;

  if to_regclass('public.student_subjects') is not null and to_regclass('public.subjects') is not null then
    delete from public.student_subjects
    where student_id = any(p_student_ids);

    insert into public.student_subjects (student_id, subject_id)
    with failed_subjects as (
      select distinct g.student_id, g.subject_id
      from public.grades g
      where g.student_id = any(p_student_ids)
        and g.grade_status = 'failed'
        and g.subject_id is not null
    ),
    promoted_subjects as (
      select st.id as student_id, sub.id as subject_id
      from public.students st
      join public.subjects sub
        on sub.course_id = st.course_id
       and sub.year_level = st.grade_level
       and public.subject_catalog_semester_number(sub.semester) = 1
      where st.id = any(p_student_ids)
        and st.course_id is not null
        and public.student_prerequisites_met(st.id, sub.id)
    )
    select student_id, subject_id from promoted_subjects
    union
    select student_id, subject_id from failed_subjects
    on conflict (student_id, subject_id) do nothing;
  end if;

  if p_to_section_id is not null then
    perform public.assign_students_to_section(p_student_ids, p_to_section_id, 'promote', effective_sy);
  end if;

  return affected;
end;
$$;
