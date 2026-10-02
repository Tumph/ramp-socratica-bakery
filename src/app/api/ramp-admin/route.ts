import { NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_COOKIE, checkPassword } from "@/lib/ramp/admin-auth";

export const runtime = "nodejs";

const schema = z.object({ password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  try {
    const { password } = schema.parse(await request.json());
    const token = checkPassword(password);
    if (!token) {
      return NextResponse.json({ error: "That password is not correct." }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Unable to sign in." }, { status: 400 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
