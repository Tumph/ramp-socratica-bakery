import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
const linkSchema = z.object({ kind: z.enum(["DEMO", "VIDEO", "REPOSITORY", "SLIDES", "OTHER"]), label: z.string().trim().min(1).max(80), url: z.url().max(2048) });
const schema = z.object({ title: z.string().trim().max(120), tagline: z.string().trim().max(240), storyMarkdown: z.string().max(20_000), links: z.array(linkSchema).max(8) });

export async function PATCH(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const user = await getCurrentUser(); const { teamId } = await params;
    if (!user || user.teamId !== teamId) return NextResponse.json({ error: "Team membership required." }, { status: 403 });
    const body = schema.parse(await request.json()); const admin = createAdminClient();
    const { data: team } = await admin.from("teams").select("events!inner(submission_deadline_at)").eq("id", teamId).single();
    const deadline = (team?.events as unknown as { submission_deadline_at: string } | null)?.submission_deadline_at;
    if (!deadline || new Date(deadline) <= new Date()) return NextResponse.json({ error: "The project is frozen after the deadline." }, { status: 403 });
    const { data: submission, error: findError } = await admin.from("submissions").select("id").eq("team_id", teamId).single();
    if (findError || !submission) throw new Error(findError?.message ?? "Submission not found.");
    const { error } = await admin.from("submissions").update({ title: body.title, tagline: body.tagline, story_markdown: body.storyMarkdown, updated_at: new Date().toISOString() }).eq("id", submission.id);
    if (error) throw error;
    const { error: deleteError } = await admin.from("submission_links").delete().eq("submission_id", submission.id);
    if (deleteError) throw deleteError;
    if (body.links.length) {
      const { error: insertError } = await admin.from("submission_links").insert(body.links.map((link, position) => ({ submission_id: submission.id, ...link, position })));
      if (insertError) throw insertError;
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save project." }, { status: 400 }); }
}
