-- Admin accounts operate the event and must not acquire participant-level team access.
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
    if exists (
      select 1
      from public.event_admins
      where event_id = new.event_id
        and user_id = new.user_id
    ) then
      raise exception 'Admin accounts cannot join bakery teams.';
    end if;

    perform 1 from public.teams where id = new.team_id for update;
    if not found then raise exception 'Team not found.'; end if;
    select count(*) into active_count from public.team_members where team_id = new.team_id and left_at is null;
    if active_count >= 6 then raise exception 'Teams cannot have more than 6 active members.'; end if;
  end if;
  return new;
end;
$$;
