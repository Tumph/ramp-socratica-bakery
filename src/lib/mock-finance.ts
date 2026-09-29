import { createAdminClient } from "./supabase/admin";
import type { CurrentUser } from "./auth";

export async function getMockFinanceOverview(user: CurrentUser) {
  const db = createAdminClient();
  const [{ data: fund }, { data: card }] = await Promise.all([
    db.from("team_funds").select("id,currency,available_cents,status,updated_at").eq("team_id", user.teamId).single(),
    db.from("mock_cards").select("id,display_identifier,display_suffix,status,issued_at").eq("event_id", user.eventId).eq("user_id", user.id).order("issued_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!fund || !card) throw new Error("Your workshop fund or card is not ready yet.");
  const { data: transactions } = await db.from("mock_transactions").select("id,status,type,amount_cents,currency,merchant_name,created_at,order_id").eq("card_id", card.id).order("created_at", { ascending: false }).limit(10);
  return { fund: { availableCents: fund.available_cents, currency: fund.currency, status: fund.status, updatedAt: fund.updated_at }, card: { id: card.id, displayIdentifier: card.display_identifier, displaySuffix: card.display_suffix, status: card.status, issuedAt: card.issued_at }, transactions: (transactions ?? []).map(transaction => ({ id: transaction.id, status: transaction.status, type: transaction.type, amountCents: transaction.amount_cents, currency: transaction.currency, merchantName: transaction.merchant_name, createdAt: transaction.created_at, orderId: transaction.order_id })) };
}

export async function listMockTransactions(user: CurrentUser, limit: number) {
  const db = createAdminClient();
  const { data: cards } = await db.from("mock_cards").select("id").eq("event_id", user.eventId).eq("user_id", user.id);
  const cardIds = (cards ?? []).map(card => card.id);
  if (!cardIds.length) return [];
  const { data } = await db.from("mock_transactions").select("id,status,type,amount_cents,currency,merchant_name,created_at,order_id,mock_cards!inner(display_suffix)").in("card_id", cardIds).order("created_at", { ascending: false }).limit(limit);
  return (data ?? []).map(transaction => ({ id: transaction.id, status: transaction.status, type: transaction.type, amountCents: transaction.amount_cents, currency: transaction.currency, merchantName: transaction.merchant_name, createdAt: transaction.created_at, orderId: transaction.order_id, cardSuffix: (transaction.mock_cards as unknown as { display_suffix: string }).display_suffix }));
}
