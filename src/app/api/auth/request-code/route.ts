import { NextResponse } from "next/server";
import { z } from "zod";
import { requestVerificationCode } from "@/lib/auth";

export const runtime = "nodejs";

const requestSchema = z.discriminatedUnion("purpose", [
  z.object({ purpose: z.literal("SIGNUP"), email: z.email(), teamCode: z.string().min(1).max(80) }),
  z.object({ purpose: z.literal("LOGIN"), email: z.email() }),
]);

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    return NextResponse.json(await requestVerificationCode(input));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send a code." },
      { status: 400 },
    );
  }
}
