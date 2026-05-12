-- Promotion rules:
-- 1) Students with INC grades cannot be promoted.
-- 2) Failed subjects remain enrolled as back subjects after promotion.

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

  -- Promote year level in students.
  update public.students st
  set grade_level = public._next_year_level(st.grade_level)
  where st.id = any(p_student_ids);

  get diagnostics affected = row_count;

  -- Promote year level in users (if linked).
  update public.users u
  set year_level = public._next_year_level(u.year_level)
  from public.students st
  where st.id = any(p_student_ids)
    and st.user_id = u.id;

  -- If no official target section is selected, bump legacy section codes (e.g., 3n1 -> 4n1).
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

  -- Rebuild enrollment list:
  -- - new year-level subjects
  -- - plus failed subjects from previous year as back subjects
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
      where st.id = any(p_student_ids)
        and st.course_id is not null
        and coalesce(nullif(trim(sub.semester), ''), '1st Sem') in ('1st Sem', '2nd Sem')
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
