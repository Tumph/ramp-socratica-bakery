// Product administration is part of the canonical /api/admin surface.
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth";
import { isProductImageAsset } from "@/lib/store/product-assets";
import { createAdminClient } from "@/lib/supabase/admin";

const productPatchSchema = z.object({
  vendorSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1_000).optional(),
  unit: z.string().trim().min(1).max(40).optional(),
  priceCents: z.number().int().min(1).max(10_000_000).optional(),
  perTeamLimit: z.number().int().min(1).max(1_000).optional(),
  inventoryQuantity: z.number().int().min(0).max(100_000).optional(),
  imageFilename: z.string().min(1).max(200).optional(),
  active: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "Choose at least one change.");

export async function PATCH(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const input = productPatchSchema.parse(await request.json());
    if (input.imageFilename && !isProductImageAsset(input.imageFilename)) throw new Error("Choose an available product image.");
    const { productId } = await params;
    const db = createAdminClient();
    const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) changes.name = input.name;
    if (input.description !== undefined) changes.description = input.description;
    if (input.unit !== undefined) changes.unit = input.unit;
    if (input.priceCents !== undefined) changes.price_cents = input.priceCents;
    if (input.perTeamLimit !== undefined) changes.per_team_limit = input.perTeamLimit;
    if (input.inventoryQuantity !== undefined) changes.inventory_quantity = input.inventoryQuantity;
    if (input.imageFilename !== undefined) changes.image_filename = input.imageFilename;
    if (input.active !== undefined) changes.active = input.active;
    if (input.vendorSlug !== undefined) {
      const { data: vendor, error: vendorError } = await db.from("vendors").select("id").eq("slug", input.vendorSlug).eq("active", true).single();
      if (vendorError || !vendor) throw new Error("The selected active store is unavailable.");
      changes.vendor_id = vendor.id;
    }
    const { error } = await db.from("store_products").update(changes).eq("id", productId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update product." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ productId: string }> }) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const { productId } = await params;
  const { error } = await createAdminClient().from("store_products").update({ active: false, updated_at: new Date().toISOString() }).eq("id", productId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
