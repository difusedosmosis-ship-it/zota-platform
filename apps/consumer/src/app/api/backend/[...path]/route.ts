import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "@/lib/server/auth-cookie";
import { BACKEND_BASE_URL } from "@/lib/backend-base";

const BACKEND = BACKEND_BASE_URL;

async function forward(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const requestId = randomUUID();
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  const session = await getServerSession();
  const { path } = await ctx.params;

  const endpoint = `/${path.join("/")}`;
  const query = req.nextUrl.search || "";
  const target = `${BACKEND}${endpoint}${query}`;

  try {
    const body = req.method === "GET" || req.method === "DELETE" ? undefined : await req.text();

    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "x-request-id": requestId,
        ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const text = await upstream.text();
    console.info(JSON.stringify({ type: "audit", action: "proxy", requestId, method: req.method, endpoint, status: upstream.status, durationMs: Date.now() - started, userId: session?.user.id ?? null }));

    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    clearTimeout(timer);
    const message =
      error instanceof DOMException && error.name === "AbortError"
        ? "Upstream backend timed out."
        : "Gateway error";
    return NextResponse.json({ ok: false, message }, { status: 502, headers: { "x-request-id": requestId } });
  }
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
