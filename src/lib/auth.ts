import { createAdminClient } from "./supabase/admin";
import { createServerSupabaseClient } from "./supabase/server";

export const EVENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export type AuthenticatedUser = { id: string; email: string };
export type CurrentUser = AuthenticatedUser & { teamId: string; teamName: string; memberRole: "OWNER" | "MEMBER"; eventId: string };

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createServerSupabaseClient(); const { data } = await supabase.auth.getClaims(); const claims = data?.claims;
  if (!claims?.sub || typeof claims.email !== "string") return null;
  const admin = createAdminClient();
  await admin.from("profiles").upsert({ id: claims.sub, email: claims.email }, { onConflict: "id", ignoreDuplicates: true });
  const { data: bootstrap } = await admin.from("superadmin_bootstraps").select("event_id,consumed_at").eq("email", claims.email.toLowerCase()).maybeSingle();
  if (bootstrap && !bootstrap.consumed_at) {
    await admin.from("event_admins").upsert({ event_id: bootstrap.event_id, user_id: claims.sub, role: "SUPERADMIN" }, { onConflict: "event_id,user_id" });
    await admin.from("superadmin_bootstraps").update({ consumed_by: claims.sub, consumed_at: new Date().toISOString() }).eq("email", claims.email.toLowerCase()).is("consumed_at", null);
  }
  return { id: claims.sub, email: claims.email };
}
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const user = await getAuthenticatedUser(); if (!user) return null;
  const { data } = await createAdminClient().from("team_members").select("team_id,event_id,role,teams!inner(name)").eq("user_id", user.id).eq("event_id", EVENT_ID).is("left_at", null).maybeSingle();
  if (!data) return null; return { ...user, teamId: data.team_id, eventId: data.event_id, teamName: (data.teams as unknown as { name: string }).name, memberRole: data.role as "OWNER" | "MEMBER" };
}
export async function getCurrentAdmin() {
  const user = await getAuthenticatedUser(); if (!user) return null;
  const { data } = await createAdminClient().from("event_admins").select("role").eq("event_id", EVENT_ID).eq("user_id", user.id).maybeSingle();
  return data ? { ...user, role: data.role as "ADMIN" | "SUPERADMIN" } : null;
}
