import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMockFinanceOverview } from "@/lib/mock-finance";
export async function GET() { try { const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Team membership required." }, { status: 403 }); return NextResponse.json(await getMockFinanceOverview(user)); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load workshop finance." }, { status: 400 }); } }
