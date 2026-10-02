// Vendor administration is part of the canonical /api/admin surface.
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({ displayName: z.string().trim().min(1).max(120).optional(), active: z.boolean().optional() }).refine((value) => Object.keys(value).length > 0);

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const input = patchSchema.parse(await request.json());
    const { slug } = await params;
    const db = createAdminClient();
    if (input.active === false) {
      const { data: vendor } = await db.from("vendors").select("id").eq("slug", slug).single();
      if (!vendor) throw new Error("Store not found.");
      const { count, error: countError } = await db.from("store_products").select("id", { count: "exact", head: true }).eq("vendor_id", vendor.id).eq("active", true);
      if (countError) throw new Error(countError.message);
      if (count) throw new Error("Reassign or archive this store's active products before archiving it.");
    }
    const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.displayName !== undefined) changes.display_name = input.displayName;
    if (input.active !== undefined) changes.active = input.active;
    const { error } = await db.from("vendors").update(changes).eq("slug", slug);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update store." }, { status: 400 });
  }
}
