// Vendor administration is part of the canonical /api/admin surface.
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const vendorSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(80),
  displayName: z.string().trim().min(1).max(120),
});

export async function GET() {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const { data, error } = await createAdminClient().from("vendors").select("id,slug,display_name,active").order("active", { ascending: false }).order("display_name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ vendors: (data ?? []).map((vendor) => ({ id: vendor.id, slug: vendor.slug, displayName: vendor.display_name, active: vendor.active })) });
}

export async function POST(request: Request) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const input = vendorSchema.parse(await request.json());
    const { error } = await createAdminClient().from("vendors").insert({ slug: input.slug, display_name: input.displayName });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create store." }, { status: 400 });
  }
}
