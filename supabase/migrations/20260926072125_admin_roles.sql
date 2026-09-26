create or replace function public.admin_set_event_admin(
  target_event_id uuid,
  target_user_id uuid,
  target_role text
) returns void
language plpgsql
set search_path = public
as $$
declare superadmin_count integer;
begin
  if target_role is not null and target_role not in ('ADMIN', 'SUPERADMIN') then raise exception 'Invalid admin role.'; end if;
  if target_role is null or target_role = 'ADMIN' then
    if exists (select 1 from event_admins where event_id = target_event_id and user_id = target_user_id and role = 'SUPERADMIN') then
      perform 1 from event_admins where event_id = target_event_id and role = 'SUPERADMIN' for update;
      select count(*) into superadmin_count from event_admins where event_id = target_event_id and role = 'SUPERADMIN';
      if superadmin_count <= 1 then raise exception 'The final Superadmin cannot be removed or demoted.'; end if;
    end if;
  end if;

  if target_role is null then
    delete from event_admins where event_id = target_event_id and user_id = target_user_id;
  else
    insert into event_admins (event_id, user_id, role) values (target_event_id, target_user_id, target_role)
    on conflict (event_id, user_id) do update set role = excluded.role;
  end if;
end;
$$;

revoke all on function public.admin_set_event_admin(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_event_admin(uuid, uuid, text) to service_role;
