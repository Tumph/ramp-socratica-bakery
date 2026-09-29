import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const requestSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const { token } = requestSchema.parse(await request.json());
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { error } = await createAdminClient().rpc("accept_team_invitation", {
      target_token_hash: tokenHash,
      target_user_id: user.id,
      target_email: user.email,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to accept invitation." }, { status: 400 });
  }
}
