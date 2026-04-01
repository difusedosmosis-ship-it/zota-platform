import { NextResponse } from "next/server";
import { applyServerSession } from "@/lib/server/auth-cookie";
import { randomUUID } from "crypto";
import { BACKEND_BASE_URL } from "@/lib/backend-base";

const BACKEND = BACKEND_BASE_URL;

function normalizeMessage(input?: string) {
  if (!input) return "Registration failed";
  const m = input.toLowerCase();
  if (m.includes("tenant or user not found") || m.includes("error querying the database")) {
    return "Database connection is not configured for this environment.";
  }
  if (m.includes("user already exists")) return "This account already exists.";
  return input;
}

export async function POST(req: Request) {
  const requestId = randomUUID();
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const body = await req.json();
    const upstream = await fetch(`${BACKEND}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-request-id": requestId },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const text = await upstream.text();
    const data = text ? JSON.parse(text) : {};

    if (!upstream.ok || !data?.token || !data?.user) {
      return NextResponse.json(
        { ok: false, message: normalizeMessage(data?.message) },
        { status: upstream.status, headers: { "x-request-id": requestId } },
      );
    }

    console.info(JSON.stringify({ type: "audit", action: "session_register", requestId, status: 200, durationMs: Date.now() - started, userId: data.user.id, role: data.user.role }));
    const response = NextResponse.json({ ok: true, user: data.user }, { headers: { "x-request-id": requestId } });
    applyServerSession(response, { token: data.token, user: data.user });
    return response;
  } catch (error) {
    clearTimeout(timer);
    const message =
      error instanceof DOMException && error.name === "AbortError"
        ? "Backend request timed out. Check Render backend and database connection."
        : "Registration error";
    return NextResponse.json({ ok: false, message }, { status: 500, headers: { "x-request-id": requestId } });
  }
}
