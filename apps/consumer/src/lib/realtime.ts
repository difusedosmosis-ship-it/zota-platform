import { BACKEND_BASE_URL } from "@/lib/backend-base";

export function getRealtimeBase() {
  const apiBase = BACKEND_BASE_URL;
  return apiBase.replace(/^http/, "ws");
}

export async function fetchWsToken() {
  const res = await fetch("/api/session/ws-token");
  const data = (await res.json()) as { ok: boolean; token?: string; message?: string };
  if (!res.ok || !data.ok || !data.token) throw new Error(data.message ?? "Could not load realtime token");
  return data.token;
}
