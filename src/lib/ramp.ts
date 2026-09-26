import { randomUUID } from "node:crypto";

export type RampBillInput = {
  entityId: string | null;
  vendorId?: string;
  invoiceNumber: string;
  totalCents: number;
  issuedAt?: string;
  lines: Array<{ name: string; quantity: number; unitPriceCents: number }>;
};

export type RampResource = {
  id: string;
  entity_id: string;
  draft_bill_id?: string | null;
  invoice_number: string;
  amount: { amount: number; currency_code: string };
  vendor: { id: string };
  status: string;
  status_summary?: string;
  invoice_urls?: string[];
};

let cachedToken: { value: string; expiresAt: number; key: string } | undefined;

export function rampBaseUrl() {
  const base = process.env.RAMP_API_BASE_URL ?? "https://demo-api.ramp.com";
  if (base !== "https://demo-api.ramp.com") throw new Error("This workshop integration only supports Ramp Sandbox.");
  return base;
}

export async function getRampAccessToken() {
  rampBaseUrl();
  if (process.env.RAMP_ACCESS_TOKEN) return process.env.RAMP_ACCESS_TOKEN;
  const clientId = process.env.RAMP_CLIENT_ID;
  const clientSecret = process.env.RAMP_CLIENT_SECRET;
  const scope = process.env.RAMP_SCOPES ?? "bills:read bills:write entities:read vendors:read";
  if (!clientId || !clientSecret) throw new Error("Set RAMP_CLIENT_ID and RAMP_CLIENT_SECRET (or RAMP_ACCESS_TOKEN) for sandbox mode.");
  const key = `${clientId}:${scope}`;
  if (cachedToken && cachedToken.key === key && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const response = await fetch(`${rampBaseUrl()}/developer/v1/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope }),
    cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Ramp authentication failed (${response.status}). Check Sandbox credentials, Client Credentials grant, and scopes.`);
  const token = await response.json() as { access_token?: string; expires_in?: number };
  if (!token.access_token || typeof token.expires_in !== "number" || !Number.isFinite(token.expires_in) || token.expires_in <= 0) throw new Error("Ramp returned an invalid token response.");
  cachedToken = { value: token.access_token, key, expiresAt: Date.now() + Math.max(0, token.expires_in - 60) * 1000 };
  return token.access_token;
}

export async function rampRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!path.startsWith("/developer/v1/")) throw new Error("Invalid Ramp API path.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${await getRampAccessToken()}`);
  if (typeof init.body === "string") headers.set("Content-Type", "application/json");
  const response = await fetch(`${rampBaseUrl()}${path}`, {
    ...init, headers, cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  // Never return provider response bodies, which may contain credentials or contact details.
  if (!response.ok) throw new Error(`Ramp ${init.method ?? "GET"} ${path.split("?")[0]} failed (${response.status}).`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function createRampBill(input: RampBillInput) {
  if ((process.env.RAMP_MODE ?? "mock") === "mock") return { id: `mock_bill_${randomUUID()}`, status: "APPROVAL_PENDING", mode: "mock" as const };
  const vendorId = input.vendorId ?? process.env.RAMP_VENDOR_ID;
  if (!input.entityId || !vendorId) throw new Error("The team's Ramp entity mapping and RAMP_VENDOR_ID are required in sandbox mode.");
  const issued = input.issuedAt ?? new Date().toISOString().slice(0, 10);
  const due = new Date(`${issued}T00:00:00Z`);
  due.setUTCDate(due.getUTCDate() + 7);
  const bill = await rampRequest<RampResource>("/developer/v1/bills/drafts", {
    method: "POST",
    body: JSON.stringify({
      entity_id: input.entityId, vendor_id: vendorId,
      invoice_number: input.invoiceNumber, invoice_currency: "CAD",
      issued_at: issued, due_at: due.toISOString().slice(0, 10),
      memo: `Socratica Bakery workshop - ${input.invoiceNumber}. Fictional supplies; Sandbox only.`,
      // Draft inputs use major units; GET responses use minor units. Verified against Sandbox.
      line_items: input.lines.map(line => ({ memo: `${line.name} x ${line.quantity}`, amount: ((line.unitPriceCents * line.quantity) / 100).toFixed(2), accounting_field_selections: [] })),
      // The workshop supplier is configured with a fictional ACH account in Sandbox.
      // This keeps bills in Ramp's Bill Pay path instead of waiting for a card transaction.
      use_default_payment_method: true,
      enable_accounting_sync: false,
    }),
  });
  if (!bill.id) throw new Error("Ramp did not return a draft ID; reconcile before retrying.");
  return { id: bill.id, status: "DRAFT", mode: "sandbox" as const };
}

export async function findRampResources(kind: "bills" | "bills/drafts", filters: Record<string, string>) {
  let path: string | null = `/developer/v1/${kind}?${new URLSearchParams({ ...filters, page_size: "100" })}`;
  const rows: RampResource[] = [];
  const visited = new Set<string>();
  while (path) {
    if (visited.has(path)) throw new Error("Ramp pagination repeated a page.");
    visited.add(path);
    const page: { data: RampResource[]; page?: { next?: string | null } } = await rampRequest(path);
    if (!Array.isArray(page.data)) throw new Error("Invalid Ramp list response.");
    rows.push(...page.data);
    const next = page.page?.next;
    if (next) {
      const url = new URL(next, rampBaseUrl());
      if (url.origin !== rampBaseUrl() || url.pathname !== `/developer/v1/${kind}`) throw new Error("Unexpected Ramp pagination URL.");
      path = url.pathname + url.search;
    } else path = null;
  }
  return rows;
}

export async function attachRampInvoice(draftId: string, invoiceNumber: string, pdf: Uint8Array) {
  const form = new FormData();
  form.set("attachment_type", "INVOICE");
  form.set("file", new Blob([Uint8Array.from(pdf)], { type: "application/pdf" }), `${invoiceNumber}.pdf`);
  return rampRequest(`/developer/v1/bills/drafts/${encodeURIComponent(draftId)}/attachments`, { method: "POST", body: form });
}
