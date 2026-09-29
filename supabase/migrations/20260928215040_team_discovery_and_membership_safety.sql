-- Serialize active membership inserts per team so concurrent direct joins cannot exceed six members.
create or replace function private.enforce_team_size()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_count integer;
begin
  if new.left_at is null and (tg_op = 'INSERT' or old.left_at is not null or old.team_id <> new.team_id) then
    perform 1 from public.teams where id = new.team_id for update;
    if not found then raise exception 'Team not found.'; end if;
    select count(*) into active_count from public.team_members where team_id = new.team_id and left_at is null;
    if active_count >= 6 then raise exception 'Teams cannot have more than 6 active members.'; end if;
  end if;
  return new;
end;
$$;

-- The application calls this only with its server-side Supabase secret key. It locks the
-- team before testing eligibility, so a concurrent archive or join cannot admit someone
-- into an unavailable or full team.
create or replace function public.join_event_team(
  target_team_id uuid,
  target_event_id uuid,
  target_user_id uuid
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform 1
  from teams
  where id = target_team_id
    and event_id = target_event_id
    and status in ('FORMING', 'ACTIVE')
  for update;
  if not found then raise exception 'This team is no longer open to join.'; end if;

  if exists (
    select 1 from team_members
    where event_id = target_event_id
      and user_id = target_user_id
      and left_at is null
  ) then
    raise exception 'You are already on a team.';
  end if;

  insert into team_members (event_id, team_id, user_id, role)
  values (target_event_id, target_team_id, target_user_id, 'MEMBER');
end;
$$;

revoke all on function public.join_event_team(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.join_event_team(uuid, uuid, uuid) to service_role;

-- A former member must not retain direct Data API access to their old team.
create or replace function private.is_team_member(target_team_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_members
    where team_id = target_team_id
      and user_id = (select auth.uid())
      and left_at is null
  );
$$;
