import { notFound, redirect } from "next/navigation";
import { getCurrentAdmin, getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { TeamPanel } from "@/components/TeamPanel";
import { submissionImageUrl } from "@/lib/submissions";

export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  if (await getCurrentAdmin()) redirect("/admin");
  const user = await getCurrentUser(); if (!user) redirect("/");
  const { id } = await params; if (id !== user.teamId) notFound();
  const admin = createAdminClient();
  const [{ data: team }, { data: members }, { data: submission }] = await Promise.all([
    admin.from("teams").select("name,events!inner(submission_deadline_at)").eq("id", id).single(),
    admin.from("team_members").select("role,profiles!inner(email)").eq("team_id", id).is("left_at", null),
    admin.from("submissions").select("id,title,tagline,story_markdown").eq("team_id", id).single(),
  ]);
  if (!team || !submission) notFound();
  const deadline = (team.events as unknown as { submission_deadline_at: string }).submission_deadline_at;
  const roster = (members ?? []).map((member) => ({ role: member.role, email: (member.profiles as unknown as { email: string }).email }));
  const [{ data: links }, { data: assets }] = await Promise.all([
    admin.from("submission_links").select("id,kind,label,url,position").eq("submission_id", submission.id).order("position"),
    admin.from("submission_assets").select("id,storage_path,caption,alt_text,position").eq("submission_id", submission.id).order("position"),
  ]);
  const submissionForEditor = { ...submission, links: links ?? [], assets: (assets ?? []).map((asset) => ({ ...asset, url: submissionImageUrl(asset.storage_path) })) };
  return <main><TeamPanel teamId={id} name={team.name} members={roster} deadline={deadline} submission={submissionForEditor} /></main>;
}
