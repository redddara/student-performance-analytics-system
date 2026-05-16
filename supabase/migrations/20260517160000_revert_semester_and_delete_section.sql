-- Revert students to 1st semester (repeat) and safe section deletion.

create or replace function public.revert_students_to_first_semester(p_student_ids uuid[])
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
  set current_semester = 1
  where st.id = any(p_student_ids)
    and coalesce(st.current_semester, 1) = 2;

  get diagnostics affected = row_count;

  if to_regclass('public.student_subjects') is not null and to_regclass('public.subjects') is not null then
    delete from public.student_subjects ss
    using public.students st, public.subjects sub
    where ss.student_id = st.id
      and ss.subject_id = sub.id
      and st.id = any(p_student_ids)
      and sub.course_id = st.course_id
      and sub.year_level = st.grade_level
      and public.subject_catalog_semester_number(sub.semester) = 2;

    insert into public.student_subjects (student_id, subject_id)
    select st.id, sub.id
    from public.students st
    join public.subjects sub
      on sub.course_id = st.course_id
     and sub.year_level = st.grade_level
     and public.subject_catalog_semester_number(sub.semester) = 1
    where st.id = any(p_student_ids)
      and st.course_id is not null
      and public.student_prerequisites_met(st.id, sub.id)
    on conflict (student_id, subject_id) do nothing;

    insert into public.student_subjects (student_id, subject_id)
    select distinct g.student_id, g.subject_id
    from public.grades g
    inner join public.subjects sub on sub.id = g.subject_id
    inner join public.students st on st.id = g.student_id
    where g.student_id = any(p_student_ids)
      and g.grade_status = 'failed'
      and sub.course_id = st.course_id
      and sub.year_level = st.grade_level
      and public.subject_catalog_semester_number(sub.semester) = 1
    on conflict (student_id, subject_id) do nothing;
  end if;

  return affected;
end;
$$;

create or replace function public.delete_section(p_section_id uuid)
returns void
language plpgsql
as $$
declare
  assigned_count int;
begin
  if p_section_id is null then
    raise exception 'Section id is required';
  end if;

  if not exists (select 1 from public.sections where id = p_section_id) then
    raise exception 'Section not found';
  end if;

  select count(*)
  into assigned_count
  from public.students
  where section_id = p_section_id;

  if coalesce(assigned_count, 0) > 0 then
    raise exception
      'Cannot delete section: % student(s) are still assigned. Reassign or unassign them first.',
      assigned_count;
  end if;

  delete from public.student_section_assignments
  where section_id = p_section_id;

  delete from public.sections
  where id = p_section_id;
end;
$$;
