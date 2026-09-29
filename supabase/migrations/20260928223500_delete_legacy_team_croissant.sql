-- Remove the pre-launch legacy team that lacks a submission record.
-- This migration is intentionally scoped to the one known empty legacy team.
do $$
declare
  legacy_team_id constant uuid := '11111111-1111-4111-8111-111111111111';
begin
  if not exists (select 1 from public.teams where id = legacy_team_id) then
    raise exception 'Legacy Team Croissant Bakery (%) was not found.', legacy_team_id;
  end if;

  if exists (select 1 from public.orders where team_id = legacy_team_id)
     or exists (select 1 from public.inventory where team_id = legacy_team_id) then
    raise exception 'Legacy Team Croissant Bakery has operational data and cannot be deleted.';
  end if;

  update public.team_members
  set left_at = now()
  where team_id = legacy_team_id
    and left_at is null;

  if not found then
    raise exception 'Legacy Team Croissant Bakery has no active membership to remove.';
  end if;

  update public.teams
  set owner_user_id = null,
      status = 'ARCHIVED'
  where id = legacy_team_id;

  perform public.admin_delete_empty_team(legacy_team_id);
end;
$$;
