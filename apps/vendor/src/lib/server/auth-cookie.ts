import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

export const COOKIE_NAME = "bm_session";

type CookiePayload = {
  token: string;
  user: {
    id: string;
    role: "CONSUMER" | "VENDOR" | "ADMIN";
    email?: string | null;
    phone?: string | null;
  };
};

function toB64(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromB64(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

export function encodePayload(payload: CookiePayload): string {
  return toB64(JSON.stringify(payload));
}

export function decodePayload(value?: string | null): CookiePayload | null {
  if (!value) return null;
  try {
    return JSON.parse(fromB64(value)) as CookiePayload;
  } catch {
    return null;
  }
}

export async function getServerSession() {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  return decodePayload(raw);
}

export async function setServerSession(payload: CookiePayload) {
  const store = await cookies();
  store.set(COOKIE_NAME, encodePayload(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearServerSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export function getSessionFromRequest(req: NextRequest) {
  return decodePayload(req.cookies.get(COOKIE_NAME)?.value);
}
