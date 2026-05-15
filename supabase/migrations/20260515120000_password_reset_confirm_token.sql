-- Support two-step forgot password: confirmation link before issuing a new password.

alter table public.users
  add column if not exists password_reset_confirm_token text,
  add column if not exists password_reset_confirm_expires_at timestamptz;

create index if not exists idx_users_password_reset_confirm_token
  on public.users (password_reset_confirm_token)
  where password_reset_confirm_token is not null;

-- Lets the anon client validate a reset token without broad read access on users.
create or replace function public.get_user_by_password_reset_confirm_token(p_token text)
returns table (
  id uuid,
  email text,
  first_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select u.id, u.email, u.first_name
  from public.users u
  where u.password_reset_confirm_token is not null
    and u.password_reset_confirm_token = p_token
    and u.password_reset_confirm_expires_at is not null
    and u.password_reset_confirm_expires_at > now()
  limit 1;
$$;

revoke all on function public.get_user_by_password_reset_confirm_token(text) from public;
grant execute on function public.get_user_by_password_reset_confirm_token(text) to anon, authenticated;
