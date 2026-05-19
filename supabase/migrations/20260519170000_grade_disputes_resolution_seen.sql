-- Track when a student has seen a resolved dispute (stops repeat bell notifications).

alter table if exists public.grade_disputes
  add column if not exists resolution_seen_at timestamptz;

create index if not exists idx_grade_disputes_student_unseen_resolved
  on public.grade_disputes (student_id, resolved_at desc)
  where status in ('accepted', 'rejected') and resolution_seen_at is null;
