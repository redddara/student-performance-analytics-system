-- Advance only eligible students in a batch; skip the rest (no all-or-nothing error).

drop function if exists public.advance_students_to_second_semester(uuid[]);

create function public.advance_students_to_second_semester(p_student_ids uuid[])
returns jsonb
language plpgsql
as $$
declare
  eligible_ids uuid[];
  affected int := 0;
  skipped int := 0;
  total int := 0;
begin
  if p_student_ids is null or array_length(p_student_ids, 1) is null then
    return jsonb_build_object('advanced', 0, 'skipped', 0);
  end if;

  total := array_length(p_student_ids, 1);

  select coalesce(array_agg(st.id), array[]::uuid[])
  into eligible_ids
  from public.students st
  where st.id = any(p_student_ids)
    and coalesce(st.current_semester, 1) = 1
    and public.student_can_advance_to_second_semester(st.id);

  if coalesce(array_length(eligible_ids, 1), 0) = 0 then
    return jsonb_build_object('advanced', 0, 'skipped', total);
  end if;

  update public.students st
  set current_semester = 2
  where st.id = any(eligible_ids);

  get diagnostics affected = row_count;

  if to_regclass('public.student_subjects') is not null and to_regclass('public.subjects') is not null then
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

  return jsonb_build_object('advanced', affected, 'skipped', skipped);
end;
$$;
