-- teams.id is application-assigned in the existing schema, so accept the UUID from
-- the trusted server rather than relying on a database default.
drop function public.create_event_team(uuid, uuid, text, text);

create function public.create_event_team(
  target_team_id uuid,
  target_event_id uuid,
  target_user_id uuid,
  target_name text,
  target_slug text
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
begin
  if exists (
    select 1 from team_members
    where event_id = target_event_id
      and user_id = target_user_id
      and left_at is null
  ) then
    raise exception 'You are already on a team.';
  end if;

  insert into teams (id, event_id, name, slug, starting_cash_cents, available_cash_cents, owner_user_id)
  values (target_team_id, target_event_id, target_name, target_slug, 0, 0, target_user_id);

  insert into team_members (event_id, team_id, user_id, role)
  values (target_event_id, target_team_id, target_user_id, 'OWNER');

  insert into submissions (event_id, team_id)
  values (target_event_id, target_team_id);

  return target_team_id;
end;
$$;

revoke all on function public.create_event_team(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_event_team(uuid, uuid, uuid, text, text) to service_role;
