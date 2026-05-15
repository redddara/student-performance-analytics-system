-- OTP step for forgot password (SHA-256 hash matches app hashPassword()).

create extension if not exists pgcrypto with schema extensions;

alter table public.users
  add column if not exists password_reset_otp_hash text;

create index if not exists idx_users_password_reset_otp_hash
  on public.users (password_reset_otp_hash)
  where password_reset_otp_hash is not null;

-- Lets the anon client validate email + OTP without broad read access on users.
create or replace function public.get_user_by_password_reset_otp(p_email text, p_otp text)
returns table (
  id uuid,
  email text,
  first_name text
)
language sql
security definer
set search_path = public, extensions
as $$
  select u.id, u.email, u.first_name
  from public.users u
  where lower(trim(u.email)) = lower(trim(p_email))
    and u.password_reset_otp_hash is not null
    and u.password_reset_confirm_expires_at is not null
    and u.password_reset_confirm_expires_at > now()
    and u.password_reset_otp_hash = encode(digest(btrim(p_otp), 'sha256'), 'hex')
  limit 1;
$$;

revoke all on function public.get_user_by_password_reset_otp(text, text) from public;
grant execute on function public.get_user_by_password_reset_otp(text, text) to anon, authenticated;
