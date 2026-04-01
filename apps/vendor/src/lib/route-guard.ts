import { clearSession, readSession, restoreSessionFromServer, type Session, type SessionUser } from "@/lib/session";

type RouterLike = {
  replace: (href: string) => void;
};

export async function requireRole(router: RouterLike, role: SessionUser["role"]): Promise<Session | null> {
  const session = readSession() ?? (await restoreSessionFromServer());
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
