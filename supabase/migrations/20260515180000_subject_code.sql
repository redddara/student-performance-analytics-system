-- Subject catalog code (required for new rows; backfill unique codes from name).
alter table public.subjects
  add column if not exists code text;

-- Step 1: assign a base code from the subject name (or SUB + id fragment if name yields nothing).
with base as (
  select
    id,
    coalesce(
      nullif(upper(left(regexp_replace(trim(name), '[^a-zA-Z0-9]', '', 'g'), 8)), ''),
      'SUB' || upper(substr(replace(id::text, '-', ''), 1, 4))
    ) as base_code
  from public.subjects
  where code is null or trim(code) = ''
),
numbered as (
  select
    id,
    base_code,
    row_number() over (partition by base_code order by id) as rn
  from base
)
update public.subjects s
set code = case
  when n.rn = 1 then n.base_code
  else left(n.base_code, 6) || lpad(n.rn::text, 2, '0')
end
from numbered n
where s.id = n.id;

-- Step 2: resolve any remaining duplicates (e.g. pre-existing codes, same prefix).
with dupes as (
  select
    id,
    upper(trim(code)) as normalized,
    row_number() over (partition by lower(trim(code)) order by id) as rn
  from public.subjects
  where code is not null and trim(code) <> ''
),
to_fix as (
  select id, normalized, rn from dupes where rn > 1
)
update public.subjects s
set code = left(tf.normalized, 6) || upper(substr(replace(s.id::text, '-', ''), 1, 4))
from to_fix tf
where s.id = tf.id;

-- Normalize stored codes to uppercase.
update public.subjects
set code = upper(trim(code))
where code is not null and trim(code) <> '';

create unique index if not exists subjects_code_unique_idx
  on public.subjects (lower(code))
  where code is not null and trim(code) <> '';
