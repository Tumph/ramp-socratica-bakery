-- A vendor is the merchant shown on a simulated Ramp transaction. Stores are
-- deployed together, but each checkout is charged to exactly one vendor.
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vendors enable row level security;
revoke all on public.vendors from anon, authenticated;
grant all on public.vendors to service_role;

-- Retain a disabled legacy vendor only to attribute historical orders. New
-- stores must be explicitly registered by their own frontend migration.
insert into public.vendors (slug, display_name, active)
values ('socratica-bakery-supply', 'Socratica Bakery Supply', false)
on conflict (slug) do update set display_name = excluded.display_name, active = false;

alter table public.orders add column vendor_id uuid references public.vendors(id) on delete restrict;

update public.orders
set vendor_id = (select id from public.vendors where slug = 'socratica-bakery-supply')
where vendor_id is null;

alter table public.orders alter column vendor_id set not null;
create index orders_vendor_id_idx on public.orders(vendor_id);

-- The vendor is looked up here instead of trusting a merchant name from the
-- application. This keeps the posted finance record and order attributable to
-- the same registered vendor.
drop function public.post_mock_card_purchase(uuid, uuid, uuid, uuid, uuid, text, jsonb);

create function public.post_mock_card_purchase(
  target_event_id uuid,
  target_team_id uuid,
  target_user_id uuid,
  target_request_id uuid,
  target_order_id uuid,
  target_invoice_number text,
  target_vendor_slug text,
  target_lines jsonb
) returns table(order_id uuid, transaction_id uuid, total_cents integer, available_cents integer, transaction_status text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_fund_id uuid;
  target_card_id uuid;
  target_vendor_id uuid;
  target_merchant_name text;
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

  select id, display_name into target_vendor_id, target_merchant_name
  from public.vendors
  where slug = target_vendor_slug and active;
  if target_vendor_id is null then raise exception 'This store is unavailable.'; end if;

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
    values (target_fund_id, target_card_id, total, target_merchant_name, 'DECLINED', target_request_id, 'Insufficient shared-fund balance')
    returning id into authorization_id;
    insert into public.mock_transactions(fund_id, card_id, authorization_id, type, status, amount_cents, merchant_name)
    values (target_fund_id, target_card_id, authorization_id, 'PURCHASE', 'DECLINED', total, target_merchant_name)
    returning id into created_transaction_id;
    return query select null::uuid, created_transaction_id, total, balance_before, 'DECLINED'::text;
    return;
  end if;

  insert into public.orders(id, team_id, vendor_id, invoice_number, status, total_cents, paid_at, fulfilled_at)
  values (target_order_id, target_team_id, target_vendor_id, target_invoice_number, 'FULFILLED', total, now(), now());

  insert into public.order_lines(order_id, product_id, product_name, quantity, unit_price_cents)
  select target_order_id, value->>'productId', value->>'productName', (value->>'quantity')::integer, (value->>'unitPriceCents')::integer
  from jsonb_array_elements(target_lines);

  insert into public.mock_authorizations(fund_id, card_id, order_id, amount_cents, merchant_name, status, idempotency_key)
  values (target_fund_id, target_card_id, target_order_id, total, target_merchant_name, 'CAPTURED', target_request_id)
  returning id into authorization_id;

  insert into public.mock_transactions(fund_id, card_id, authorization_id, order_id, type, status, amount_cents, merchant_name)
  values (target_fund_id, target_card_id, authorization_id, target_order_id, 'PURCHASE', 'POSTED', total, target_merchant_name)
  returning id into created_transaction_id;

  update public.team_funds set available_cents = balance_before - total, updated_at = now() where id = target_fund_id;
  insert into public.fund_ledger_entries(fund_id, transaction_id, entry_type, amount_cents, balance_after_cents, actor_user_id, reason)
  values (target_fund_id, created_transaction_id, 'PURCHASE', -total, balance_before - total, target_user_id, 'Supplier purchase: ' || target_merchant_name);

  insert into public.inventory(team_id, product_id, product_name, quantity)
  select target_team_id, value->>'productId', value->>'productName', (value->>'quantity')::integer
  from jsonb_array_elements(target_lines)
  on conflict (team_id, product_id) do update set quantity = public.inventory.quantity + excluded.quantity;

  return query select target_order_id, created_transaction_id, total, balance_before - total, 'POSTED'::text;
end;
$$;

revoke all on function public.post_mock_card_purchase(uuid, uuid, uuid, uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.post_mock_card_purchase(uuid, uuid, uuid, uuid, uuid, text, text, jsonb) to service_role;
