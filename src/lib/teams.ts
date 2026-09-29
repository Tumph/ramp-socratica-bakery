import { createAdminClient } from "./supabase/admin";
export async function shopAccess(teamId: string) {
  const admin = createAdminClient();
  const [{ data: event }, { count }, { data: submission }] = await Promise.all([
    admin.from("teams").select("events!inner(submission_deadline_at)").eq("id", teamId).single(),
    admin.from("team_members").select("id", { count: "exact", head: true }).eq("team_id", teamId).is("left_at", null),
    admin.from("submissions").select("id").eq("team_id", teamId).maybeSingle(),
  ]);
  const deadline = (event?.events as unknown as { submission_deadline_at: string } | null)?.submission_deadline_at;
  return { allowed: !!deadline && new Date(deadline) <= new Date() && (count ?? 0) >= 3 && !!submission, memberCount: count ?? 0, deadline };
}
