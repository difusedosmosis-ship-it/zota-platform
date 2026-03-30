import { clearSession, readSession, type Session, type SessionUser } from "@/lib/session";

type RouterLike = {
  replace: (href: string) => void;
};

export function requireRole(router: RouterLike, role: SessionUser["role"]): Session | null {
  const session = readSession();
  if (!session) {
    router.replace("/login");
    return null;
  }

  if (session.user.role !== role) {
    clearSession();
    router.replace("/login");
    return null;
  }

  return session;
}
