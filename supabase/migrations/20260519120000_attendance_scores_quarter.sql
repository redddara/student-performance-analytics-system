-- Attendance scores: 100 = present, 50 = late, 0 = absent; period (quarter) on sessions.

alter table public.attendance_records
  add column if not exists score smallint;

update public.attendance_records
set score = case when is_present then 100 else 0 end
where score is null;

alter table public.attendance_records
  alter column score set default 0;

alter table public.attendance_records
  drop constraint if exists attendance_records_score_check;

alter table public.attendance_records
  add constraint attendance_records_score_check
  check (score in (0, 50, 100));

alter table public.attendance_sessions
  add column if not exists quarter smallint;

alter table public.attendance_sessions
  drop constraint if exists attendance_sessions_quarter_check;

alter table public.attendance_sessions
  add constraint attendance_sessions_quarter_check
  check (quarter is null or (quarter >= 1 and quarter <= 4));

create index if not exists idx_attendance_sessions_subject_quarter
  on public.attendance_sessions (subject_id, quarter);
