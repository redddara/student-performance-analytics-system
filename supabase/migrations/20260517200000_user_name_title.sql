-- Honorific for teachers (Mr., Mrs., Ms.) shown on student grade reports.
alter table public.users
  add column if not exists name_title text;

comment on column public.users.name_title is 'Teacher honorific: Mr., Mrs., or Ms.';
