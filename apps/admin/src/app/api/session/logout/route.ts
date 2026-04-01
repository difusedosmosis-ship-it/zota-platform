import { NextResponse } from "next/server";
import { applyClearedServerSession } from "@/lib/server/auth-cookie";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  applyClearedServerSession(response);
  return response;
}
