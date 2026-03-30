export function getRealtimeBase() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
  return apiBase.replace(/^http/, "ws");
}

export async function fetchWsToken() {
  const res = await fetch("/api/session/ws-token");
  const data = (await res.json()) as { ok: boolean; token?: string; message?: string };
  if (!res.ok || !data.ok || !data.token) throw new Error(data.message ?? "Could not load realtime token");
  return data.token;
}
