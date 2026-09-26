import { NextResponse } from "next/server";
export function POST() { return NextResponse.json({ error: "Use the sign-in link from your email." }, { status: 410 }); }
