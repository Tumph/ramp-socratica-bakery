import { NextResponse } from "next/server";
import { z } from "zod";
import { sessionCookie, verifyCodeAndCreateSession } from "@/lib/auth";

export const runtime = "nodejs";

const verifySchema = z.object({
  email: z.email(),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  try {
    const input = verifySchema.parse(await request.json());
    const session = verifyCodeAndCreateSession(input.email, input.code);
    const response = NextResponse.json({ verified: true });
    const cookie = sessionCookie(session.token, session.expiresAt);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to verify this code." },
      { status: 400 },
    );
  }
}
