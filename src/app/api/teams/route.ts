import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser, getCurrentAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const renameSchema = z.object({ teamId: z.uuid(), name: z.string().trim().min(3).max(80) });

export async function PATCH(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (await getCurrentAdmin()) return NextResponse.json({ error: "Admin accounts cannot rename a bakery team." }, { status: 403 });
    const { teamId, name } = renameSchema.parse(await request.json());
    const admin = createAdminClient();
    const { data: member } = await admin.from("team_members").select("id").eq("team_id", teamId).eq("user_id", user.id).is("left_at", null).maybeSingle();
    if (!member) return NextResponse.json({ error: "Team membership required." }, { status: 403 });
    const { data: team } = await admin.from("teams").select("events!inner(submission_deadline_at)").eq("id", teamId).maybeSingle();
    const deadline = (team?.events as unknown as { submission_deadline_at: string } | null)?.submission_deadline_at;
    if (!deadline || new Date(deadline) <= new Date()) return NextResponse.json({ error: "The team workspace is frozen after the submission deadline." }, { status: 403 });
    const { error } = await admin.from("teams").update({ name }).eq("id", teamId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to rename team." }, { status: 400 });
  }
}
