-- Workshop-only card simulator. These tables never contain usable payment credentials.
create table public.team_funds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  team_id uuid not null unique references public.teams(id) on delete cascade,
  currency text not null default 'CAD' check (currency = 'CAD'),
  available_cents integer not null default 0 check (available_cents >= 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'FROZEN')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mock_cards (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  fund_id uuid not null references public.team_funds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_identifier text not null unique check (display_identifier like 'BAKE-%'),
  display_suffix text not null check (char_length(display_suffix) = 4),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'FROZEN', 'REVOKED')),
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'REVOKED') = (revoked_at is not null))
);
create unique index mock_cards_one_active_card_per_event_user
  on public.mock_cards(event_id, user_id) where status in ('ACTIVE', 'FROZEN');
create index mock_cards_fund_id_idx on public.mock_cards(fund_id);

create table public.mock_authorizations (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.team_funds(id) on delete restrict,
  card_id uuid references public.mock_cards(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  merchant_name text not null,
  status text not null check (status in ('APPROVED', 'DECLINED', 'REVERSED', 'EXPIRED', 'CAPTURED')),
  idempotency_key uuid not null,
  decline_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(fund_id, idempotency_key)
);
create index mock_authorizations_fund_created_idx on public.mock_authorizations(fund_id, created_at desc);

create table public.mock_transactions (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.team_funds(id) on delete restrict,
  card_id uuid references public.mock_cards(id) on delete set null,
  authorization_id uuid unique references public.mock_authorizations(id) on delete set null,
  order_id uuid unique references public.orders(id) on delete set null,
  type text not null check (type in ('PURCHASE', 'REFUND', 'REVERSAL')),
  status text not null check (status in ('PENDING', 'POSTED', 'REVERSED', 'REFUNDED', 'DECLINED')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'CAD' check (currency = 'CAD'),
  merchant_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index mock_transactions_card_created_idx on public.mock_transactions(card_id, created_at desc);
create index mock_transactions_fund_created_idx on public.mock_transactions(fund_id, created_at desc);

create table public.fund_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.team_funds(id) on delete restrict,
  transaction_id uuid references public.mock_transactions(id) on delete restrict,
  entry_type text not null check (entry_type in ('INITIAL_FUNDING', 'ADMIN_ADJUSTMENT', 'PURCHASE', 'REVERSAL', 'REFUND')),
  amount_cents integer not null check (amount_cents <> 0),
  balance_after_cents integer not null check (balance_after_cents >= 0),
  actor_user_id uuid references public.profiles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);
create index fund_ledger_entries_fund_created_idx on public.fund_ledger_entries(fund_id, created_at desc);

alter table public.team_funds enable row level security;
alter table public.mock_cards enable row level security;
alter table public.mock_authorizations enable row level security;
alter table public.mock_transactions enable row level security;
alter table public.fund_ledger_entries enable row level security;
revoke all on public.team_funds, public.mock_cards, public.mock_authorizations, public.mock_transactions, public.fund_ledger_entries from anon, authenticated;
grant all on public.team_funds, public.mock_cards, public.mock_authorizations, public.mock_transactions, public.fund_ledger_entries to service_role;

create or replace function public.sync_mock_card_for_membership()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_fund_id uuid;
  suffix text;
begin
  if tg_op = 'UPDATE' and old.left_at is null and new.left_at is not null then
    update public.mock_cards
    set status = 'REVOKED', revoked_at = now(), updated_at = now()
    where event_id = old.event_id and user_id = old.user_id and status in ('ACTIVE', 'FROZEN');
    return new;
  end if;

  if tg_op = 'INSERT' and new.left_at is null then
    insert into public.team_funds(event_id, team_id)
    values (new.event_id, new.team_id)
    on conflict (team_id) do nothing;

    select id into target_fund_id from public.team_funds where team_id = new.team_id;
    suffix := lpad(abs(hashtext(new.user_id::text)::bigint % 10000)::text, 4, '0');
    insert into public.mock_cards(event_id, fund_id, user_id, display_identifier, display_suffix)
    values (new.event_id, target_fund_id, new.user_id, 'BAKE-' || upper(substr(replace(new.id::text, '-', ''), 1, 8)), suffix)
    on conflict (event_id, user_id) where status in ('ACTIVE', 'FROZEN') do nothing;
  end if;
  return new;
end;
$$;

create trigger team_members_sync_mock_cards
  after insert or update of left_at on public.team_members
  for each row execute function public.sync_mock_card_for_membership();

-- Backfill funds and cards for any existing active teams/members.
insert into public.team_funds(event_id, team_id, available_cents)
select event_id, id, available_cash_cents from public.teams
on conflict (team_id) do nothing;

insert into public.fund_ledger_entries(fund_id, entry_type, amount_cents, balance_after_cents, reason)
select fund.id, 'INITIAL_FUNDING', fund.available_cents, fund.available_cents, 'Migrated from team available cash'
from public.team_funds fund
where fund.available_cents > 0;

insert into public.mock_cards(event_id, fund_id, user_id, display_identifier, display_suffix)
select member.event_id, fund.id, member.user_id,
       'BAKE-' || upper(substr(replace(member.id::text, '-', ''), 1, 8)),
       lpad(abs(hashtext(member.user_id::text)::bigint % 10000)::text, 4, '0')
from public.team_members member
join public.team_funds fund on fund.team_id = member.team_id
where member.left_at is null
on conflict (event_id, user_id) where status in ('ACTIVE', 'FROZEN') do nothing;

create or replace function public.post_mock_card_purchase(
  target_event_id uuid,
  target_team_id uuid,
  target_user_id uuid,
  target_request_id uuid,
  target_order_id uuid,
  target_invoice_number text,
  target_lines jsonb
) returns table(order_id uuid, transaction_id uuid, total_cents integer, available_cents integer, transaction_status text)
language plpgsql
set search_path = public
as $$
declare
  target_fund_id uuid;
  target_card_id uuid;
  balance_before integer;
  total integer := 0;
  item jsonb;
  quantity integer;
  unit_price integer;
  product_id text;
  product_name text;
  existing_authorization_id uuid;
  existing_order_id uuid;
  existing_transaction_id uuid;
  existing_total integer;
  existing_status text;
  authorization_id uuid;
  created_transaction_id uuid;
begin
  if jsonb_typeof(target_lines) <> 'array' or jsonb_array_length(target_lines) = 0 then
    raise exception 'Choose at least one product.';
  end if;

  select id, available_cents into target_fund_id, balance_before
  from public.team_funds
  where event_id = target_event_id and team_id = target_team_id and status = 'ACTIVE'
  for update;
  if target_fund_id is null then raise exception 'This team does not have an active shared fund.'; end if;

  select auth.id, auth.order_id, txn.id, auth.amount_cents, auth.status
  into existing_authorization_id, existing_order_id, existing_transaction_id, existing_total, existing_status
  from public.mock_authorizations auth
  left join public.mock_transactions txn on txn.authorization_id = auth.id
  where auth.fund_id = target_fund_id and auth.idempotency_key = target_request_id;
  if existing_authorization_id is not null then
    return query select existing_order_id, existing_transaction_id, existing_total, balance_before, case when existing_status = 'DECLINED' then 'DECLINED' else 'POSTED' end;
    return;
  end if;

  select id into target_card_id
  from public.mock_cards
  where event_id = target_event_id and fund_id = target_fund_id and user_id = target_user_id and status = 'ACTIVE'
  for update;
  if target_card_id is null then raise exception 'You do not have an active workshop card for this team.'; end if;
  if not exists (select 1 from public.team_members where event_id = target_event_id and team_id = target_team_id and user_id = target_user_id and left_at is null) then
    raise exception 'Active team membership is required.';
  end if;

  for item in select value from jsonb_array_elements(target_lines) loop
    product_id := item->>'productId';
    product_name := item->>'productName';
    quantity := (item->>'quantity')::integer;
    unit_price := (item->>'unitPriceCents')::integer;
    if product_id is null or product_name is null or quantity is null or unit_price is null or quantity < 1 or quantity > 20 or unit_price < 0 then
      raise exception 'Invalid purchase item.';
    end if;
    total := total + quantity * unit_price;
  end loop;
  if total <= 0 then raise exception 'Purchase total must be positive.'; end if;

  if balance_before < total then
    insert into public.mock_authorizations(fund_id, card_id, amount_cents, merchant_name, status, idempotency_key, decline_reason)
    values (target_fund_id, target_card_id, total, 'Socratica Bakery Supply', 'DECLINED', target_request_id, 'Insufficient shared-fund balance')
    returning id into authorization_id;
    insert into public.mock_transactions(fund_id, card_id, authorization_id, type, status, amount_cents, merchant_name)
    values (target_fund_id, target_card_id, authorization_id, 'PURCHASE', 'DECLINED', total, 'Socratica Bakery Supply')
    returning id into created_transaction_id;
    return query select null::uuid, created_transaction_id, total, balance_before, 'DECLINED'::text;
    return;
  end if;

  insert into public.orders(id, team_id, invoice_number, status, total_cents, paid_at, fulfilled_at)
  values (target_order_id, target_team_id, target_invoice_number, 'FULFILLED', total, now(), now());

  insert into public.order_lines(order_id, product_id, product_name, quantity, unit_price_cents)
  select target_order_id, value->>'productId', value->>'productName', (value->>'quantity')::integer, (value->>'unitPriceCents')::integer
  from jsonb_array_elements(target_lines);

  insert into public.mock_authorizations(fund_id, card_id, order_id, amount_cents, merchant_name, status, idempotency_key)
  values (target_fund_id, target_card_id, target_order_id, total, 'Socratica Bakery Supply', 'CAPTURED', target_request_id)
  returning id into authorization_id;

  insert into public.mock_transactions(fund_id, card_id, authorization_id, order_id, type, status, amount_cents, merchant_name)
  values (target_fund_id, target_card_id, authorization_id, target_order_id, 'PURCHASE', 'POSTED', total, 'Socratica Bakery Supply')
  returning id into created_transaction_id;

  update public.team_funds set available_cents = balance_before - total, updated_at = now() where id = target_fund_id;
  insert into public.fund_ledger_entries(fund_id, transaction_id, entry_type, amount_cents, balance_after_cents, actor_user_id, reason)
  values (target_fund_id, created_transaction_id, 'PURCHASE', -total, balance_before - total, target_user_id, 'Supplier purchase');

  insert into public.inventory(team_id, product_id, product_name, quantity)
  select target_team_id, value->>'productId', value->>'productName', (value->>'quantity')::integer
  from jsonb_array_elements(target_lines)
  on conflict (team_id, product_id) do update set quantity = public.inventory.quantity + excluded.quantity;

  return query select target_order_id, created_transaction_id, total, balance_before - total, 'POSTED'::text;
end;
$$;

create or replace function public.admin_set_team_fund(
  target_team_id uuid,
  target_balance_cents integer,
  adjustment_reason text,
  actor_user_id uuid
) returns integer
language plpgsql
set search_path = public
as $$
declare target_fund_id uuid; previous_balance integer;
begin
  if target_balance_cents < 0 then raise exception 'Fund balance cannot be negative.'; end if;
  select id, available_cents into target_fund_id, previous_balance from public.team_funds where team_id = target_team_id for update;
  if target_fund_id is null then raise exception 'Team fund not found.'; end if;
  if previous_balance <> target_balance_cents then
    update public.team_funds set available_cents = target_balance_cents, updated_at = now() where id = target_fund_id;
    insert into public.fund_ledger_entries(fund_id, entry_type, amount_cents, balance_after_cents, actor_user_id, reason)
    values (target_fund_id, 'ADMIN_ADJUSTMENT', target_balance_cents - previous_balance, target_balance_cents, actor_user_id, nullif(trim(adjustment_reason), ''));
  end if;
  return target_balance_cents;
end;
$$;

revoke all on function public.sync_mock_card_for_membership() from public, anon, authenticated;
revoke all on function public.post_mock_card_purchase(uuid, uuid, uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.admin_set_team_fund(uuid, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.post_mock_card_purchase(uuid, uuid, uuid, uuid, uuid, text, jsonb) to service_role;
grant execute on function public.admin_set_team_fund(uuid, integer, text, uuid) to service_role;
