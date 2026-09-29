import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser, getCurrentAdmin } from "@/lib/auth";
import { createTeam, joinTeam, listJoinableTeams } from "@/lib/teams";

const createTeamSchema = z.object({ action: z.literal("create"), name: z.string().trim().min(3).max(80) });
const joinTeamSchema = z.object({ action: z.literal("join"), teamId: z.uuid() });

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (await getCurrentAdmin()) return NextResponse.json({ error: "Admin accounts cannot join or manage a bakery team." }, { status: 403 });
  try {
    return NextResponse.json({ teams: await listJoinableTeams() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to list teams." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (await getCurrentAdmin()) return NextResponse.json({ error: "Admin accounts cannot join or manage a bakery team." }, { status: 403 });
    const input = z.discriminatedUnion("action", [createTeamSchema, joinTeamSchema]).parse(await request.json());
    const teamId = input.action === "create" ? await createTeam(user, input.name) : await joinTeam(user, input.teamId);
    return NextResponse.json({ teamId }, { status: input.action === "create" ? 201 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to join or create a team." }, { status: 400 });
  }
}
export async function PATCH(request: Request) { try { const user=await getAuthenticatedUser(); if(!user) return NextResponse.json({error:"Sign in required."},{status:401}); if(await getCurrentAdmin()) return NextResponse.json({error:"Admin accounts cannot join or manage a bakery team."},{status:403}); const {teamId,name}=z.object({teamId:z.uuid(),name:z.string().trim().min(3).max(80)}).parse(await request.json()); const {data:member}=await (await import("@/lib/supabase/admin")).createAdminClient().from("team_members").select("id").eq("team_id",teamId).eq("user_id",user.id).is("left_at",null).maybeSingle(); if(!member) return NextResponse.json({error:"Team membership required."},{status:403}); const {error}=await (await import("@/lib/supabase/admin")).createAdminClient().from("teams").update({name}).eq("id",teamId); if(error) throw error; return NextResponse.json({ok:true}); } catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"Unable to rename team."},{status:400}); } }
