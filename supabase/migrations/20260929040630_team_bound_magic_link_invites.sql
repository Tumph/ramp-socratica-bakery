-- Invitations bind a recipient email to one team before authentication. The
-- browser only receives an opaque, one-time token; the database keeps its hash.
create table public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  email text not null check (email = lower(email)),
  token_hash text not null unique check (char_length(token_hash) = 64),
  expires_at timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  check (expires_at > created_at),
  check (not (accepted_at is not null and revoked_at is not null))
);
create index team_invitations_team_status_idx
  on public.team_invitations(team_id, expires_at)
  where accepted_at is null and revoked_at is null;

alter table public.team_invitations enable row level security;
revoke all on public.team_invitations from anon, authenticated;
grant all on public.team_invitations to service_role;

create function public.admin_create_team_invitation(
  target_event_id uuid,
  target_team_id uuid,
  target_email text,
  target_token_hash text,
  target_expires_at timestamptz,
  actor_user_id uuid
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  invitation_id uuid;
  normalized_email text := lower(trim(target_email));
  active_count integer;
  pending_count integer;
begin
  if normalized_email = '' then raise exception 'An email address is required.'; end if;
  if char_length(target_token_hash) <> 64 then raise exception 'Invitation token is invalid.'; end if;
  if target_expires_at <= now() then raise exception 'Invitation expiry must be in the future.'; end if;

  perform 1 from teams
  where id = target_team_id and event_id = target_event_id and status <> 'ARCHIVED'
  for update;
  if not found then raise exception 'Team is unavailable.'; end if;

  if exists (
    select 1 from event_admins admin
    join profiles profile on profile.id = admin.user_id
    where admin.event_id = target_event_id and profile.email = normalized_email
  ) then
    raise exception 'Admin accounts cannot be invited to a bakery team.';
  end if;

  if exists (
    select 1 from team_members member
    join profiles profile on profile.id = member.user_id
    where member.event_id = target_event_id and member.left_at is null and profile.email = normalized_email
  ) then
    raise exception 'This person is already assigned to a team.';
  end if;

  update team_invitations
  set revoked_at = now()
  where team_id = target_team_id
    and email = normalized_email
    and accepted_at is null
    and revoked_at is null;

  select count(*) into active_count
  from team_members
  where team_id = target_team_id and left_at is null;
  select count(*) into pending_count
  from team_invitations
  where team_id = target_team_id
    and accepted_at is null
    and revoked_at is null
    and expires_at > now();
  if active_count + pending_count >= 6 then
    raise exception 'This team already has six participants or pending invitations.';
  end if;

  insert into team_invitations (event_id, team_id, email, token_hash, expires_at, created_by)
  values (target_event_id, target_team_id, normalized_email, target_token_hash, target_expires_at, actor_user_id)
  returning id into invitation_id;

  return invitation_id;
end;
$$;

create function public.accept_team_invitation(
  target_token_hash text,
  target_user_id uuid,
  target_email text
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  invitation_record public.team_invitations%rowtype;
  membership_id uuid;
begin
  -- Read once to find the team, then lock the team before locking the invite.
  -- This matches the lock order used when an Admin replaces an invitation.
  select * into invitation_record
  from team_invitations
  where token_hash = target_token_hash;
  if not found then
    raise exception 'This invitation is invalid or has expired.';
  end if;

  perform 1 from teams
  where id = invitation_record.team_id and event_id = invitation_record.event_id and status <> 'ARCHIVED'
  for update;
  if not found then raise exception 'This team is unavailable.'; end if;

  select * into invitation_record
  from team_invitations
  where id = invitation_record.id
  for update;
  if invitation_record.accepted_at is not null
    or invitation_record.revoked_at is not null
    or invitation_record.expires_at <= now() then
    raise exception 'This invitation is invalid or has expired.';
  end if;

  if invitation_record.email <> lower(trim(target_email)) then
    raise exception 'Sign in with the email address that received this invitation.';
  end if;

  if exists (
    select 1 from event_admins
    where event_id = invitation_record.event_id and user_id = target_user_id
  ) then
    raise exception 'Admin accounts cannot join bakery teams.';
  end if;

  if exists (
    select 1 from team_members
    where event_id = invitation_record.event_id and user_id = target_user_id and left_at is null
  ) then
    raise exception 'You are already assigned to a team.';
  end if;

  insert into team_members (event_id, team_id, user_id, role)
  values (invitation_record.event_id, invitation_record.team_id, target_user_id, 'MEMBER')
  returning id into membership_id;

  update team_invitations
  set accepted_at = now(), accepted_by = target_user_id
  where id = invitation_record.id;

  return membership_id;
end;
$$;

revoke all on function public.admin_create_team_invitation(uuid, uuid, text, text, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.accept_team_invitation(text, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_create_team_invitation(uuid, uuid, text, text, timestamptz, uuid) to service_role;
grant execute on function public.accept_team_invitation(text, uuid, text) to service_role;

-- This one-time manual assignment operation has been replaced by invitations.
drop function if exists public.admin_assign_unassigned_member(uuid, uuid);
