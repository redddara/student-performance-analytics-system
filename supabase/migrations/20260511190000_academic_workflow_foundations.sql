-- Additive academic workflow foundations.
-- This migration is designed to be backward compatible with current flows.

create table if not exists public.school_years (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default false,
  is_archived boolean not null default false,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now()
);

create table if not exists public.system_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  is_active boolean not null default true,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

alter table if exists public.students
  add column if not exists student_status text not null default 'active';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'students_student_status_check'
  ) then
    alter table public.students
      add constraint students_student_status_check
      check (student_status in ('active', 'inactive', 'graduated', 'transferred'));
  end if;
end $$;

alter table if exists public.grades
  add column if not exists school_year_id uuid references public.school_years (id) on delete set null,
  add column if not exists workflow_status text not null default 'draft',
  add column if not exists is_locked boolean not null default false,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references public.users (id) on delete set null,
  add column if not exists unlock_requested boolean not null default false,
  add column if not exists unlock_reason text,
  add column if not exists unlock_requested_at timestamptz,
  add column if not exists unlock_requested_by uuid references public.users (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'grades_workflow_status_check'
  ) then
    alter table public.grades
      add constraint grades_workflow_status_check
      check (workflow_status in ('draft', 'for_review', 'approved', 'reopened'));
  end if;
end $$;

create table if not exists public.subject_prerequisites (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  prerequisite_subject_id uuid not null references public.subjects (id) on delete cascade,
  minimum_grade numeric(5,2) not null default 75,
  created_at timestamptz not null default now(),
  unique (subject_id, prerequisite_subject_id),
  check (subject_id <> prerequisite_subject_id)
);

create table if not exists public.grade_disputes (
  id uuid primary key default gen_random_uuid(),
  grade_id uuid not null references public.grades (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  teacher_id uuid references public.users (id) on delete set null,
  reason text not null,
  status text not null default 'pending',
  teacher_response text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (status in ('pending', 'accepted', 'rejected'))
);

create table if not exists public.student_academic_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  school_year_id uuid references public.school_years (id) on delete set null,
  semester smallint,
  subject_id uuid references public.subjects (id) on delete set null,
  final_grade numeric(5,2),
  gwa numeric(5,2),
  standing text,
  remarks text,
  created_at timestamptz not null default now()
);

create index if not exists idx_grades_workflow_status on public.grades (workflow_status);
create index if not exists idx_grades_is_locked on public.grades (is_locked);
create index if not exists idx_grades_school_year_id on public.grades (school_year_id);
create index if not exists idx_students_student_status on public.students (student_status);
create index if not exists idx_system_announcements_active on public.system_announcements (is_active, created_at desc);

-- Ensure at most one active school year.
create unique index if not exists uq_school_years_single_active
  on public.school_years ((is_active))
  where is_active = true;

insert into public.school_years (name, is_active, is_archived)
select '2024-2025', true, false
where not exists (select 1 from public.school_years);
