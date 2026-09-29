-- A merged source team is an abandoned record. Preserve it for administration but
-- remove it from participant discovery as part of the same locked merge operation.
create or replace function public.admin_merge_teams(source_team_id uuid, destination_team_id uuid, actor_user_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  source_size integer;
  destination_size integer;
  source_balance integer;
  destination_balance integer;
  event_uuid uuid;
  source_name text;
begin
  if source_team_id = destination_team_id then raise exception 'Choose two different teams.'; end if;
  perform 1 from teams where id in (source_team_id, destination_team_id) order by id for update;
  if (select count(*) from teams where id in (source_team_id, destination_team_id)) <> 2 then raise exception 'Team not found.'; end if;
  select event_id, name, available_cash_cents into event_uuid, source_name, source_balance from teams where id = source_team_id;
  select available_cash_cents into destination_balance from teams where id = destination_team_id;
  if not exists (select 1 from teams where id = source_team_id and event_id = event_uuid and status <> 'ARCHIVED') then raise exception 'Source team is unavailable.'; end if;
  if not exists (select 1 from teams where id = destination_team_id and event_id = event_uuid and status <> 'ARCHIVED') then raise exception 'Destination team is unavailable.'; end if;
  if exists (select 1 from orders where team_id in (source_team_id, destination_team_id)) then raise exception 'Teams with orders cannot be merged.'; end if;
  select count(*) into source_size from team_members where team_id = source_team_id and left_at is null;
  select count(*) into destination_size from team_members where team_id = destination_team_id and left_at is null;
  if source_size + destination_size > 6 then raise exception 'The merged team would exceed six participants.'; end if;

  with moved as (
    update team_members set left_at = now() where team_id = source_team_id and left_at is null returning user_id
  )
  insert into team_members (event_id, team_id, user_id, role)
  select event_uuid, destination_team_id, user_id, 'MEMBER' from moved;

  update teams
  set owner_user_id = null,
      available_cash_cents = 0,
      balance_updated_at = now(),
      status = 'ARCHIVED'
  where id = source_team_id;
  update teams set available_cash_cents = destination_balance + source_balance, balance_updated_at = now() where id = destination_team_id;
  update team_invites set revoked_at = now() where team_id = source_team_id and accepted_at is null and revoked_at is null;
  insert into team_balance_adjustments (team_id, previous_balance_cents, new_balance_cents, reason, adjusted_by)
  values
    (source_team_id, source_balance, 0, 'Merged into another team', actor_user_id),
    (destination_team_id, destination_balance, destination_balance + source_balance, 'Merged in ' || source_name, actor_user_id);
end;
$$;
