import { NextResponse } from "next/server";
import { deleteCurrentSession, sessionCookieName } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  await deleteCurrentSession();
  const response = NextResponse.json({ loggedOut: true });
  response.cookies.set(sessionCookieName, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
