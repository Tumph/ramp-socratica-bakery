import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
const schema = z.object({ email: z.email() });
export async function POST(request: Request) {
  try {
    const { email } = schema.parse(await request.json());
    const origin = new URL(request.url).origin;
    const { error } = await createAdminClient().auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { emailRedirectTo: `${origin}/auth/callback` } });
    if (error) throw error;
    return NextResponse.json({ sent: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send sign-in link." }, { status: 400 }); }
}
