import { NextResponse } from "next/server";
import { clearServerSession } from "@/lib/server/auth-cookie";

export async function POST() {
  await clearServerSession();
  return NextResponse.json({ ok: true });
}
