export type SessionUser = {
  id: string;
  role: "CONSUMER" | "VENDOR" | "ADMIN";
  email?: string | null;
  phone?: string | null;
};

export type Session = {
  user: SessionUser;
};

const KEY = "bm_session";

export function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function writeSession(session: Session) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

export async function restoreSessionFromServer(): Promise<Session | null> {
  if (typeof window === "undefined") return null;

  try {
    const res = await fetch("/api/session/me", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { ok: boolean; user?: SessionUser | null };
    if (!data.ok || !data.user) return null;

    const session = { user: data.user };
    writeSession(session);
    return session;
  } catch {
    return null;
  }
}
