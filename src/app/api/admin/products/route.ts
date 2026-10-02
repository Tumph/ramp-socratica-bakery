// Product administration is part of the canonical /api/admin surface.
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth";
import { isProductImageAsset } from "@/lib/store/product-assets";
import { createAdminClient } from "@/lib/supabase/admin";

const productSchema = z.object({
  vendorSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1_000),
  unit: z.string().trim().min(1).max(40),
  priceCents: z.number().int().min(1).max(10_000_000),
  perTeamLimit: z.number().int().min(1).max(1_000),
  inventoryQuantity: z.number().int().min(0).max(100_000),
  imageFilename: z.string().min(1).max(200),
});

function productId(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
  return `${base || "product"}-${randomUUID().slice(0, 8)}`;
}

export async function POST(request: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const input = productSchema.parse(await request.json());
    if (!isProductImageAsset(input.imageFilename)) throw new Error("Choose an available product image.");

    const db = createAdminClient();
    const { data: vendor, error: vendorError } = await db
      .from("vendors")
      .select("id,slug,display_name")
      .eq("slug", input.vendorSlug)
      .eq("active", true)
      .single();
    if (vendorError || !vendor) throw new Error("The selected store is unavailable.");

    const { data: product, error } = await db
      .from("store_products")
      .insert({
        id: productId(input.name),
        vendor_id: vendor.id,
        name: input.name,
        description: input.description,
        unit: input.unit,
        price_cents: input.priceCents,
        per_team_limit: input.perTeamLimit,
        inventory_quantity: input.inventoryQuantity,
        image_filename: input.imageFilename,
      })
      .select("id,name,description,unit,price_cents,per_team_limit,inventory_quantity,image_filename,vendor_id")
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({
      product: {
        id: product.id,
        vendorSlug: vendor.slug,
        vendorName: vendor.display_name,
        name: product.name,
        description: product.description,
        unit: product.unit,
        priceCents: product.price_cents,
        perTeamLimit: product.per_team_limit,
        inventoryQuantity: product.inventory_quantity,
        imageFilename: product.image_filename,
      },
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create product." }, { status: 400 });
  }
}

export async function GET() {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const { data, error } = await createAdminClient()
    .from("store_products")
    .select("id,name,description,unit,price_cents,per_team_limit,inventory_quantity,image_filename,active,vendors!inner(slug,display_name)")
    .order("active", { ascending: false })
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    products: (data ?? []).map((product) => {
      const vendor = Array.isArray(product.vendors) ? product.vendors[0] : product.vendors;
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        unit: product.unit,
        priceCents: product.price_cents,
        perTeamLimit: product.per_team_limit,
        inventoryQuantity: product.inventory_quantity,
        imageFilename: product.image_filename,
        active: product.active,
        vendorSlug: vendor.slug,
        vendorName: vendor.display_name,
      };
    }),
  });
}
