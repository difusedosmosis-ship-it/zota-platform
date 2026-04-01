import { NextResponse } from "next/server";
import { applyServerSession } from "@/lib/server/auth-cookie";
import { randomUUID } from "crypto";
import { BACKEND_BASE_URL } from "@/lib/backend-base";

const BACKEND = BACKEND_BASE_URL;

function normalizeMessage(input?: string) {
  if (!input) return "Login failed";
  const m = input.toLowerCase();
  if (m.includes("tenant or user not found") || m.includes("error querying the database")) {
    return "Database connection is not configured for this environment.";
  }
  if (m.includes("invalid credentials")) return "Incorrect email or password.";
  return input;
}

export async function POST(req: Request) {
  const requestId = randomUUID();
  const started = Date.now();

  try {
    const body = await req.json();
    const upstream = await fetch(`${BACKEND}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-request-id": requestId },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    const data = text ? JSON.parse(text) : {};

    if (!upstream.ok || !data?.token || !data?.user) {
      return NextResponse.json(
        { ok: false, message: normalizeMessage(data?.message) },
        { status: upstream.status, headers: { "x-request-id": requestId } },
      );
    }

    console.info(JSON.stringify({ type: "audit", action: "session_login", requestId, status: 200, durationMs: Date.now() - started, userId: data.user.id }));
    const response = NextResponse.json({ ok: true, user: data.user }, { headers: { "x-request-id": requestId } });
    applyServerSession(response, { token: data.token, user: data.user });
    return response;
  } catch {
    return NextResponse.json({ ok: false, message: "Login error" }, { status: 500, headers: { "x-request-id": requestId } });
  }
}
