-- Team placement is an operator workflow. Participants authenticate first and
-- admins create teams and assign the resulting profiles.
create function public.admin_create_empty_team(
  target_team_id uuid,
  target_event_id uuid,
  target_name text,
  target_slug text
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
begin
  if nullif(trim(target_name), '') is null then
    raise exception 'A team name is required.';
  end if;

  insert into teams (id, event_id, name, slug, starting_cash_cents, available_cash_cents)
  values (target_team_id, target_event_id, trim(target_name), target_slug, 0, 0);

  insert into submissions (event_id, team_id)
  values (target_event_id, target_team_id);

  insert into team_funds (event_id, team_id)
  values (target_event_id, target_team_id);

  return target_team_id;
end;
$$;

create function public.admin_assign_unassigned_member(
  target_user_id uuid,
  target_team_id uuid
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_event_id uuid;
  membership_id uuid;
begin
  select event_id into target_event_id
  from teams
  where id = target_team_id and status <> 'ARCHIVED'
  for update;
  if target_event_id is null then
    raise exception 'Team is unavailable.';
  end if;

  if exists (
    select 1 from event_admins
    where event_id = target_event_id and user_id = target_user_id
  ) then
    raise exception 'Admin accounts cannot be assigned to a bakery team.';
  end if;

  if exists (
    select 1 from team_members
    where event_id = target_event_id and user_id = target_user_id and left_at is null
  ) then
    raise exception 'This participant is already assigned to a team.';
  end if;

  insert into team_members (event_id, team_id, user_id, role)
  values (target_event_id, target_team_id, target_user_id, 'MEMBER')
  returning id into membership_id;

  return membership_id;
end;
$$;

revoke all on function public.admin_create_empty_team(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_assign_unassigned_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_create_empty_team(uuid, uuid, text, text) to service_role;
grant execute on function public.admin_assign_unassigned_member(uuid, uuid) to service_role;

-- These supported participant self-service creation and discovery, which is no
-- longer part of the product flow.
drop function if exists public.join_event_team(uuid, uuid, uuid);
drop function if exists public.create_event_team(uuid, uuid, uuid, text, text);
