import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateInvoicePdf } from "@/lib/invoice";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await context.params;
  const { data: order } = await createAdminClient().from("orders").select("invoice_number").eq("id", id).eq("team_id", user.teamId).maybeSingle();
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
  return new Response(Uint8Array.from(await generateInvoicePdf(id)), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${order.invoice_number}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
