-- Teacher attendance records by subject and class date.
-- Apply via `supabase db push` or Supabase SQL editor.

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  attendance_date date not null,
  is_present boolean not null default false,
  marked_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_id, student_id, attendance_date)
);

create index if not exists idx_attendance_records_subject_date
  on public.attendance_records (subject_id, attendance_date);

create index if not exists idx_attendance_records_student_date
  on public.attendance_records (student_id, attendance_date);

create or replace function public.set_attendance_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_attendance_updated_at on public.attendance_records;

create trigger trg_set_attendance_updated_at
before update on public.attendance_records
for each row
execute procedure public.set_attendance_updated_at();
