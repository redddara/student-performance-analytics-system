-- Allow admin to lock student accounts when marked as dropout.
alter table if exists public.users
  add column if not exists is_dropout boolean not null default false;

comment on column public.users.is_dropout is
  'When true (student dropout), account is blocked from login.';
