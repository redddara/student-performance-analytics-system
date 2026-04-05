-- Login attempt lockout: run in Supabase SQL Editor or `supabase db push`.
-- Locks account for 30 minutes after 3 failed password attempts (same identifier).

alter table public.users
  add column if not exists login_failed_attempts integer not null default 0;

alter table public.users
  add column if not exists login_locked_until timestamptz;

create or replace function public.record_failed_login(p_lookup text, p_is_email boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  att int;
  lu timestamptz;
begin
  if p_is_email then
    select id into uid
    from users
    where lower(trim(coalesce(email, ''))) = lower(trim(p_lookup))
    limit 1;
  else
    select id into uid
    from users
    where trim(coalesce(username, '')) = trim(p_lookup)
    limit 1;
  end if;

  if uid is null then
    return jsonb_build_object('found', false);
  end if;

  update users
  set login_failed_attempts = coalesce(login_failed_attempts, 0) + 1
  where id = uid
  returning login_failed_attempts into att;

  if att >= 3 then
    update users
    set login_locked_until = now() + interval '30 minutes'
    where id = uid
    returning login_locked_until into lu;
  else
    select login_locked_until into lu from users where id = uid;
  end if;

  return jsonb_build_object(
    'found', true,
    'attempts', att,
    'locked_until', lu,
    'just_locked', att >= 3
  );
end;
$$;

create or replace function public.reset_login_after_auth(p_user_id uuid, p_password_hash text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update users
  set login_failed_attempts = 0,
      login_locked_until = null
  where id = p_user_id
    and password_hash = p_password_hash;
end;
$$;

grant execute on function public.record_failed_login(text, boolean) to anon;
grant execute on function public.record_failed_login(text, boolean) to authenticated;
grant execute on function public.reset_login_after_auth(uuid, text) to anon;
grant execute on function public.reset_login_after_auth(uuid, text) to authenticated;
