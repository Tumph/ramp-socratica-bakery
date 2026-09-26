import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { acceptInvite, createInvite } from "@/lib/teams";
export async function POST(request: Request) { try { const user = await getAuthenticatedUser(); if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 }); const body = z.discriminatedUnion("action", [z.object({ action: z.literal("create"), teamId: z.uuid() }),z.object({ action: z.literal("accept"), token: z.string().min(20) })]).parse(await request.json()); if (body.action === "create") { const token = await createInvite(user, body.teamId); return NextResponse.json({ token }); } return NextResponse.json({ teamId: await acceptInvite(user, body.token) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process invitation." }, { status: 400 }); } }
