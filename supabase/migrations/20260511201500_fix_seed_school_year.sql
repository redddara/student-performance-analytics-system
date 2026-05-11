-- Fix initial seeded school year name.
-- Earlier migration seeds '2024-2025' if the table was empty. If you're starting in SY 2025-2026,
-- this adjusts the seed safely without touching existing multi-year setups.

do $$
declare
  sy_count int;
  only_id uuid;
  only_name text;
begin
  select count(*) into sy_count from public.school_years;

  if sy_count = 1 then
    select id, name into only_id, only_name
    from public.school_years
    limit 1;

    if only_name = '2024-2025' then
      update public.school_years
      set name = '2025-2026',
          is_active = true,
          is_archived = false
      where id = only_id;
    end if;
  end if;
end $$;

