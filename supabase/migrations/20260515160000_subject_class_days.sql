-- Class meeting pattern per subject (e.g. MWF, TTH) for attendance scheduling.
alter table public.subjects
  add column if not exists class_days text;

comment on column public.subjects.class_days is
  'Meeting days pattern: MWF, TTH, MTW, MTWTHF, etc. NULL = no day restriction.';
