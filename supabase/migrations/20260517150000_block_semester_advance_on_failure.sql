-- Block advancing to 2nd semester when a student failed or has not passed
-- a 1st-semester subject for their current year level (e.g. Thesis 1).

create or replace function public.student_can_advance_to_second_semester(p_student_id uuid)
returns boolean
language plpgsql
stable
as $$
declare
  st record;
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

  -- Explicit failed standing in any 1st-semester subject for this year level.
  if exists (
    select 1
    from public.grades g
    inner join public.subjects sub on sub.id = g.subject_id
    where g.student_id = p_student_id
      and sub.course_id = st.course_id
      and sub.year_level = st.grade_level
      and public.subject_catalog_semester_number(sub.semester) = 1
      and g.grade_status = 'failed'
  ) then
    return false;
  end if;

  -- Enrolled or graded 1st-sem subject without a passing final standing.
  if exists (
    select 1
    from public.subjects sub
    where sub.course_id = st.course_id
      and sub.year_level = st.grade_level
      and public.subject_catalog_semester_number(sub.semester) = 1
      and (
        exists (
          select 1
          from public.student_subjects ss
          where ss.student_id = p_student_id
            and ss.subject_id = sub.id
        )
        or exists (
          select 1
          from public.grades g
          where g.student_id = p_student_id
            and g.subject_id = sub.id
        )
      )
      and not public.student_passed_subject(p_student_id, sub.id)
  ) then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.advance_students_to_second_semester(p_student_ids uuid[])
returns integer
language plpgsql
as $$
declare
  affected int := 0;
  blocked int := 0;
begin
  if p_student_ids is null or array_length(p_student_ids, 1) is null then
    return 0;
  end if;

  select count(*)
  into blocked
  from public.students st
  where st.id = any(p_student_ids)
    and not public.student_can_advance_to_second_semester(st.id);

  if coalesce(blocked, 0) > 0 then
    raise exception
      'Cannot advance to 2nd semester: % student(s) have failing or incomplete 1st-semester subjects (e.g. failed Thesis 1). Fix grades before advancing.',
      blocked;
  end if;

  update public.students st
  set current_semester = 2
  where st.id = any(p_student_ids)
    and coalesce(st.current_semester, 1) = 1;

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
