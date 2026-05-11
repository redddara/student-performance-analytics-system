-- Section and year level management foundations.
-- Adds official sections + assignment history + RPC helpers for:
-- - create/manage sections
-- - bulk assign / transfer students
-- - promote students to next year level

create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, -- e.g. "BSCS 1-A"
  course_id uuid references public.courses (id) on delete set null,
  year_level text, -- e.g. "1st", "2nd", "3rd", "4th"
  section_code text, -- e.g. "A", "B", "1m1" (legacy supported)
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_sections_course_year on public.sections (course_id, year_level);

alter table if exists public.students
  add column if not exists section_id uuid references public.sections (id) on delete set null;

create index if not exists idx_students_section_id on public.students (section_id);

create table if not exists public.student_section_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  section_id uuid not null references public.sections (id) on delete restrict,
  school_year_id uuid references public.school_years (id) on delete set null,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  reason text not null default 'assign',
  created_at timestamptz not null default now(),
  check (reason in ('assign', 'transfer', 'promote'))
);

create index if not exists idx_student_section_assignments_student_open
  on public.student_section_assignments (student_id)
  where ended_at is null;
create index if not exists idx_student_section_assignments_section_open
  on public.student_section_assignments (section_id)
  where ended_at is null;

create or replace function public._next_year_level(p_year_level text)
returns text
language sql
immutable
as $$
  select case trim(coalesce(p_year_level, ''))
    when '1st' then '2nd'
    when '2nd' then '3rd'
    when '3rd' then '4th'
    when '4th' then '4th'
    else p_year_level
  end
$$;

create or replace function public._year_level_digit(p_year_level text)
returns text
language sql
immutable
as $$
  select case trim(coalesce(p_year_level, ''))
    when '1st' then '1'
    when '2nd' then '2'
    when '3rd' then '3'
    when '4th' then '4'
    else null
  end
$$;

create or replace function public._bump_section_code(p_section text, p_new_year_level text)
returns text
language sql
immutable
as $$
  select case
    -- Legacy codes like 3n1 / 3m2 (case-insensitive). Replace first digit to match new year.
    when p_section ~* '^[1-4][mn][12]$' and public._year_level_digit(p_new_year_level) is not null
      then public._year_level_digit(p_new_year_level) || substr(lower(p_section), 2)
    else p_section
  end
$$;

create or replace function public._active_school_year_id()
returns uuid
language sql
stable
as $$
  select id
  from public.school_years
  where is_active = true
  limit 1
$$;

-- Bulk assign / transfer students to a section (updates students + assignment history).
create or replace function public.assign_students_to_section(
  p_student_ids uuid[],
  p_section_id uuid,
  p_reason text default 'assign',
  p_school_year_id uuid default null
)
returns integer
language plpgsql
as $$
declare
  effective_sy uuid;
  affected int := 0;
  display_value text;
begin
  if p_student_ids is null or array_length(p_student_ids, 1) is null then
    return 0;
  end if;

  if p_reason is null or p_reason not in ('assign', 'transfer', 'promote') then
    raise exception 'Invalid reason: %', p_reason;
  end if;

  effective_sy := p_school_year_id;
  if effective_sy is null then
    effective_sy := public._active_school_year_id();
  end if;

  -- End any current open assignment.
  update public.student_section_assignments
  set ended_at = now()
  where student_id = any(p_student_ids)
    and ended_at is null;

  -- Update denormalized pointer on students.
  select coalesce(nullif(trim(section_code), ''), nullif(trim(name), ''))
  into display_value
  from public.sections
  where id = p_section_id
  limit 1;

  update public.students
  set section_id = p_section_id,
      section = coalesce(display_value, section)
  where id = any(p_student_ids);

  get diagnostics affected = row_count;

  insert into public.student_section_assignments (student_id, section_id, school_year_id, reason)
  select s, p_section_id, effective_sy, p_reason
  from unnest(p_student_ids) as s;

  return affected;
end;
$$;

-- Promote students: bumps year level on students + users, and (optionally) assigns a new section.
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
begin
  if p_student_ids is null or array_length(p_student_ids, 1) is null then
    return 0;
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

  -- If no official target section is selected, bump legacy section codes (e.g., 3n1 -> 4n1)
  -- so the rest of the app stays consistent without requiring admins to create sections first.
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

  -- Auto-enroll promoted students into subjects for their new year level (all semesters).
  -- This matches existing app behavior where student_subjects drives visibility in Student/Teacher pages.
  if to_regclass('public.student_subjects') is not null and to_regclass('public.subjects') is not null then
    -- Remove old enrollments for these students (end-of-year promotion behavior).
    delete from public.student_subjects
    where student_id = any(p_student_ids);

    insert into public.student_subjects (student_id, subject_id)
    select st.id, sub.id
    from public.students st
    join public.subjects sub
      on sub.course_id = st.course_id
     and sub.year_level = st.grade_level
    where st.id = any(p_student_ids)
      and st.course_id is not null
      and coalesce(nullif(trim(sub.semester), ''), '1st Sem') in ('1st Sem', '2nd Sem')
    on conflict (student_id, subject_id) do nothing;
  end if;

  if p_to_section_id is not null then
    perform public.assign_students_to_section(p_student_ids, p_to_section_id, 'promote', effective_sy);
  end if;

  return affected;
end;
$$;

-- RLS (permissive hotfix style, consistent with existing academic/attendance migrations).
alter table if exists public.sections enable row level security;
alter table if exists public.student_section_assignments enable row level security;

drop policy if exists sections_select_policy on public.sections;
drop policy if exists sections_insert_policy on public.sections;
drop policy if exists sections_update_policy on public.sections;
drop policy if exists sections_delete_policy on public.sections;

create policy sections_select_policy on public.sections
for select to anon, authenticated
using (true);

create policy sections_insert_policy on public.sections
for insert to anon, authenticated
with check (true);

create policy sections_update_policy on public.sections
for update to anon, authenticated
using (true)
with check (true);

create policy sections_delete_policy on public.sections
for delete to anon, authenticated
using (true);

drop policy if exists student_section_assignments_select_policy on public.student_section_assignments;
drop policy if exists student_section_assignments_insert_policy on public.student_section_assignments;
drop policy if exists student_section_assignments_update_policy on public.student_section_assignments;
drop policy if exists student_section_assignments_delete_policy on public.student_section_assignments;

create policy student_section_assignments_select_policy on public.student_section_assignments
for select to anon, authenticated
using (true);

create policy student_section_assignments_insert_policy on public.student_section_assignments
for insert to anon, authenticated
with check (true);

create policy student_section_assignments_update_policy on public.student_section_assignments
for update to anon, authenticated
using (true)
with check (true);

create policy student_section_assignments_delete_policy on public.student_section_assignments
for delete to anon, authenticated
using (true);

