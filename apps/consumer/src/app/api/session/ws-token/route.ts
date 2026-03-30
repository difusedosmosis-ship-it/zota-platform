import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server/auth-cookie";

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, token: session.token, user: session.user });
}
