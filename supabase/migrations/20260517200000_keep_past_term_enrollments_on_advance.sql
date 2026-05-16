-- After semester advance, keep 1st-semester enrollments when the student has grades (passed or failed).

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
    -- Keep every 1st-semester subject the student has grades for (history + back subjects).
    insert into public.student_subjects (student_id, subject_id)
    select distinct g.student_id, g.subject_id
    from public.grades g
    inner join public.students st on st.id = g.student_id
    inner join public.subjects sub on sub.id = g.subject_id
    where g.student_id = any(eligible_ids)
      and sub.course_id = st.course_id
      and sub.year_level = st.grade_level
      and public.subject_catalog_semester_number(sub.semester) = 1
      and g.subject_id is not null
      and (
        public._active_school_year_id() is null
        or g.school_year_id = public._active_school_year_id()
      )
    on conflict (student_id, subject_id) do nothing;

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

-- Repair: students already in 2nd sem keep enrollments for 1st-sem subjects they have grades for.
insert into public.student_subjects (student_id, subject_id)
select distinct g.student_id, g.subject_id
from public.grades g
inner join public.students st on st.id = g.student_id
inner join public.subjects sub on sub.id = g.subject_id
where coalesce(st.current_semester, 1) = 2
  and sub.course_id = st.course_id
  and sub.year_level = st.grade_level
  and public.subject_catalog_semester_number(sub.semester) = 1
  and g.subject_id is not null
  and (
    public._active_school_year_id() is null
    or g.school_year_id = public._active_school_year_id()
  )
on conflict (student_id, subject_id) do nothing;
