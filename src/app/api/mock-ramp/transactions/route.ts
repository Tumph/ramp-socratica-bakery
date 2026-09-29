import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { listMockTransactions } from "@/lib/mock-finance";
export async function GET(request: Request) { try { const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Team membership required." }, { status: 403 }); const limit = z.coerce.number().int().min(1).max(100).catch(25).parse(new URL(request.url).searchParams.get("limit")); return NextResponse.json({ transactions: await listMockTransactions(user, limit) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load transactions." }, { status: 400 }); } }
