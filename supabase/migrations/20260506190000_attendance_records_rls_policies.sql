-- RLS policies for attendance records.
-- Fixes teacher save/read access for their own subjects.

alter table public.attendance_records enable row level security;

drop policy if exists attendance_records_select_policy on public.attendance_records;
drop policy if exists attendance_records_insert_policy on public.attendance_records;
drop policy if exists attendance_records_update_policy on public.attendance_records;
drop policy if exists attendance_records_delete_policy on public.attendance_records;

create policy attendance_records_select_policy
on public.attendance_records
for select
to authenticated
using (
  exists (
    select 1
    from public.subjects s
    where s.id = attendance_records.subject_id
      and (
        s.teacher_id = auth.uid()
        or exists (
          select 1
          from public.users u
          where u.id = auth.uid()
            and u.role = 'admin'
        )
      )
  )
);

create policy attendance_records_insert_policy
on public.attendance_records
for insert
to authenticated
with check (
  exists (
    select 1
    from public.subjects s
    where s.id = attendance_records.subject_id
      and (
        s.teacher_id = auth.uid()
        or exists (
          select 1
          from public.users u
          where u.id = auth.uid()
            and u.role = 'admin'
        )
      )
  )
  and (attendance_records.marked_by is null or attendance_records.marked_by = auth.uid())
);

create policy attendance_records_update_policy
on public.attendance_records
for update
to authenticated
using (
  exists (
    select 1
    from public.subjects s
    where s.id = attendance_records.subject_id
      and (
        s.teacher_id = auth.uid()
        or exists (
          select 1
          from public.users u
          where u.id = auth.uid()
            and u.role = 'admin'
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.subjects s
    where s.id = attendance_records.subject_id
      and (
        s.teacher_id = auth.uid()
        or exists (
          select 1
          from public.users u
          where u.id = auth.uid()
            and u.role = 'admin'
        )
      )
  )
  and (attendance_records.marked_by is null or attendance_records.marked_by = auth.uid())
);

create policy attendance_records_delete_policy
on public.attendance_records
for delete
to authenticated
using (
  exists (
    select 1
    from public.subjects s
    where s.id = attendance_records.subject_id
      and (
        s.teacher_id = auth.uid()
        or exists (
          select 1
          from public.users u
          where u.id = auth.uid()
            and u.role = 'admin'
        )
      )
  )
);
