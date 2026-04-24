export type SessionUser = {
  id: string;
  role: "CONSUMER" | "VENDOR" | "ADMIN";
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  officeTitle?: string | null;
  officePermissions?: string[];
  isSuperAdmin?: boolean;
  isDisabled?: boolean;
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
