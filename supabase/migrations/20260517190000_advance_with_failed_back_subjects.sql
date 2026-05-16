-- Optional admin advance: move to 2nd sem with failed 1st-sem subjects kept as back subjects.
-- 2nd-sem enrollments still require prerequisites (e.g. Thesis 1 before Thesis 2).

create or replace function public.student_has_failed_first_sem_standing(p_student_id uuid)
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

  select id, course_id, grade_level
  into st
  from public.students
  where id = p_student_id;

  if not found or st.course_id is null or st.grade_level is null then
    return false;
  end if;

  active_sy := public._active_school_year_id();

  return exists (
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
  );
end;
$$;

drop function if exists public.advance_students_to_second_semester(uuid[]);
drop function if exists public.advance_students_to_second_semester(uuid[], boolean);

create function public.advance_students_to_second_semester(
  p_student_ids uuid[],
  p_allow_failed_back_subjects boolean default false
)
returns jsonb
language plpgsql
as $$
declare
  eligible_ids uuid[];
  affected int := 0;
  skipped int := 0;
  forced int := 0;
  total int := 0;
begin
  if p_student_ids is null or array_length(p_student_ids, 1) is null then
    return jsonb_build_object('advanced', 0, 'skipped', 0, 'with_back_subjects', 0);
  end if;

  total := array_length(p_student_ids, 1);

  select coalesce(array_agg(st.id), array[]::uuid[])
  into eligible_ids
  from public.students st
  where st.id = any(p_student_ids)
    and coalesce(st.current_semester, 1) = 1
    and (
      public.student_can_advance_to_second_semester(st.id)
      or (
        p_allow_failed_back_subjects
        and not public.student_can_advance_to_second_semester(st.id)
        and public.student_has_failed_first_sem_standing(st.id)
      )
    );

  if coalesce(array_length(eligible_ids, 1), 0) = 0 then
    return jsonb_build_object('advanced', 0, 'skipped', total, 'with_back_subjects', 0);
  end if;

  select count(*)::int
  into forced
  from public.students st
  where st.id = any(eligible_ids)
    and not public.student_can_advance_to_second_semester(st.id);

  update public.students st
  set current_semester = 2
  where st.id = any(eligible_ids);

  get diagnostics affected = row_count;

  if to_regclass('public.student_subjects') is not null and to_regclass('public.subjects') is not null then
    -- Failed 1st-semester subjects stay enrolled as back subjects (repeat).
    insert into public.student_subjects (student_id, subject_id)
    select st.id, sub.id
    from public.students st
    join public.subjects sub
      on sub.course_id = st.course_id
     and sub.year_level = st.grade_level
     and public.subject_catalog_semester_number(sub.semester) = 1
    where st.id = any(eligible_ids)
      and st.course_id is not null
      and exists (
        select 1
        from public.grades g
        where g.student_id = st.id
          and g.subject_id = sub.id
          and (
            public._active_school_year_id() is null
            or g.school_year_id = public._active_school_year_id()
          )
      )
      and not public.student_passed_subject(st.id, sub.id)
    on conflict (student_id, subject_id) do nothing;

    -- 2nd-semester subjects only when prerequisites are met (blocks Thesis 2 if Thesis 1 failed).
    insert into public.student_subjects (student_id, subject_id)
    select st.id, sub.id
    from public.students st
    join public.subjects sub
      on sub.course_id = st.course_id
     and sub.year_level = st.grade_level
     and public.subject_catalog_semester_number(sub.semester) = 2
    where st.id = any(eligible_ids)
      and st.course_id is not null
      and public.student_prerequisites_met(st.id, sub.id)
    on conflict (student_id, subject_id) do nothing;
  end if;

  skipped := greatest(total - affected, 0);

  return jsonb_build_object(
    'advanced', affected,
    'skipped', skipped,
    'with_back_subjects', coalesce(forced, 0)
  );
end;
$$;
