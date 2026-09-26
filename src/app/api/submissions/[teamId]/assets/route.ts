import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { SUBMISSION_MEDIA_BUCKET, submissionImageUrl } from "@/lib/submissions";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

async function editableSubmission(teamId: string, userId: string) {
  const admin = createAdminClient();
  const { data: team } = await admin.from("teams").select("events!inner(submission_deadline_at)").eq("id", teamId).single();
  const deadline = (team?.events as unknown as { submission_deadline_at: string } | null)?.submission_deadline_at;
  if (!deadline || new Date(deadline) <= new Date()) throw new Error("The project is frozen after the deadline.");
  const { data: member } = await admin.from("team_members").select("id").eq("team_id", teamId).eq("user_id", userId).is("left_at", null).maybeSingle();
  if (!member) throw new Error("Team membership required.");
  const { data: submission, error } = await admin.from("submissions").select("id").eq("team_id", teamId).single();
  if (error || !submission) throw new Error(error?.message ?? "Submission not found.");
  return submission;
}

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const user = await getCurrentUser(); const { teamId } = await params;
    if (!user || user.teamId !== teamId) return NextResponse.json({ error: "Team membership required." }, { status: 403 });
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size > 10 * 1024 * 1024) throw new Error("Upload a JPEG, PNG, WebP, or GIF under 10 MB.");
    const submission = await editableSubmission(teamId, user.id); const admin = createAdminClient();
    const extension = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1]; const path = `${teamId}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await admin.storage.from(SUBMISSION_MEDIA_BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (uploadError) throw uploadError;
    const { data: asset, error: assetError } = await admin.from("submission_assets").insert({ submission_id: submission.id, storage_path: path, caption: String(form.get("caption") ?? "").trim() || null, alt_text: String(form.get("altText") ?? "").trim() || null }).select("id,storage_path,caption,alt_text").single();
    if (assetError || !asset) { await admin.storage.from(SUBMISSION_MEDIA_BUCKET).remove([path]); throw new Error(assetError?.message ?? "Unable to save image."); }
    return NextResponse.json({ asset: { ...asset, url: submissionImageUrl(path) } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to upload image." }, { status: 400 }); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const user = await getCurrentUser(); const { teamId } = await params; const assetId = new URL(request.url).searchParams.get("assetId");
    if (!user || user.teamId !== teamId || !assetId) return NextResponse.json({ error: "Team membership and image are required." }, { status: 403 });
    const submission = await editableSubmission(teamId, user.id); const admin = createAdminClient();
    const { data: asset } = await admin.from("submission_assets").select("id,storage_path").eq("id", assetId).eq("submission_id", submission.id).maybeSingle();
    if (!asset) throw new Error("Image not found.");
    const { error: deleteError } = await admin.from("submission_assets").delete().eq("id", asset.id);
    if (deleteError) throw deleteError;
    await admin.storage.from(SUBMISSION_MEDIA_BUCKET).remove([asset.storage_path]);
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to remove image." }, { status: 400 }); }
}
