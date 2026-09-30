-- A fund limit is the total amount a team is allowed to spend. Remaining
-- balance may be negative when an Admin lowers that limit below prior spending.
alter table public.team_funds
  add column fund_limit_cents integer not null default 0 check (fund_limit_cents >= 0);

update public.team_funds
set fund_limit_cents = available_cents;

alter table public.team_funds
  drop constraint team_funds_available_cents_check;
alter table public.fund_ledger_entries
  drop constraint fund_ledger_entries_balance_after_cents_check;

create function public.admin_set_team_fund_limits(
  target_event_id uuid,
  target_limits jsonb,
  adjustment_reason text,
  actor_user_id uuid
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  limit_row record;
  target_fund_id uuid;
  previous_limit integer;
  previous_balance integer;
  limit_delta integer;
  new_balance integer;
begin
  if jsonb_typeof(target_limits) <> 'array' or jsonb_array_length(target_limits) = 0 then
    raise exception 'At least one team fund limit is required.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(target_limits) as value(team_id uuid, fund_limit_cents integer)
    where team_id is null or fund_limit_cents is null or fund_limit_cents < 0
  ) then
    raise exception 'Fund limits must be non-negative whole cents.';
  end if;

  if exists (
    select team_id
    from jsonb_to_recordset(target_limits) as value(team_id uuid, fund_limit_cents integer)
    group by team_id
    having count(*) > 1
  ) then
    raise exception 'Each team can appear only once.';
  end if;

  for limit_row in
    select team_id, fund_limit_cents
    from jsonb_to_recordset(target_limits) as value(team_id uuid, fund_limit_cents integer)
    order by team_id
  loop
    select fund.id, fund.fund_limit_cents, fund.available_cents
    into target_fund_id, previous_limit, previous_balance
    from public.team_funds fund
    join public.teams team on team.id = fund.team_id
    where fund.team_id = limit_row.team_id
      and fund.event_id = target_event_id
      and team.status <> 'ARCHIVED'
    for update of fund, team;
    if target_fund_id is null then
      raise exception 'Team fund not found in this event.';
    end if;

    limit_delta := limit_row.fund_limit_cents - previous_limit;
    if limit_delta <> 0 then
      new_balance := previous_balance + limit_delta;
      update public.team_funds
      set fund_limit_cents = limit_row.fund_limit_cents,
          available_cents = new_balance,
          updated_at = now()
      where id = target_fund_id;
      insert into public.fund_ledger_entries(
        fund_id, entry_type, amount_cents, balance_after_cents, actor_user_id, reason
      ) values (
        target_fund_id, 'ADMIN_ADJUSTMENT', limit_delta, new_balance, actor_user_id,
        nullif(trim(adjustment_reason), '')
      );
    end if;
  end loop;
end;
$$;

revoke all on function public.admin_set_team_fund_limits(uuid, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_set_team_fund_limits(uuid, jsonb, text, uuid) to service_role;
drop function public.admin_set_team_fund(uuid, integer, text, uuid);

create or replace function public.admin_merge_teams(
  source_team_id uuid,
  destination_team_id uuid,
  actor_user_id uuid
) returns void
language plpgsql
security invoker
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
  if exists (
    select 1 from team_funds
    where team_id in (source_team_id, destination_team_id)
      and (fund_limit_cents <> 0 or available_cents <> 0)
  ) then raise exception 'Funded teams cannot be merged.'; end if;
  select count(*) into source_size from team_members where team_id = source_team_id and left_at is null;
  select count(*) into destination_size from team_members where team_id = destination_team_id and left_at is null;
  if source_size + destination_size > 6 then raise exception 'The merged team would exceed six participants.'; end if;

  with moved as (
    update team_members set left_at = now() where team_id = source_team_id and left_at is null returning user_id
  )
  insert into team_members (event_id, team_id, user_id, role)
  select event_uuid, destination_team_id, user_id, 'MEMBER' from moved;

  update team_invitations
  set revoked_at = now()
  where team_id = source_team_id and accepted_at is null and revoked_at is null;
  update teams
  set owner_user_id = null, available_cash_cents = 0, balance_updated_at = now(), status = 'ARCHIVED'
  where id = source_team_id;
  update teams set available_cash_cents = destination_balance + source_balance, balance_updated_at = now() where id = destination_team_id;
  insert into team_balance_adjustments (team_id, previous_balance_cents, new_balance_cents, reason, adjusted_by)
  values
    (source_team_id, source_balance, 0, 'Merged into another team', actor_user_id),
    (destination_team_id, destination_balance, destination_balance + source_balance, 'Merged in ' || source_name, actor_user_id);
end;
$$;

create or replace function public.admin_archive_team(target_team_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if exists (select 1 from team_members where team_id = target_team_id and left_at is null) then
    raise exception 'Reassign or remove every participant before archiving a team.';
  end if;
  update teams set status = 'ARCHIVED' where id = target_team_id;
  if not found then raise exception 'Team not found.'; end if;
  update team_invitations set revoked_at = now()
  where team_id = target_team_id and accepted_at is null and revoked_at is null;
end;
$$;
