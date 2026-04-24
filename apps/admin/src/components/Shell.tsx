"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { clearSession, readSession } from "@/lib/session";
import { ZotaLogo } from "@/components/ZotaLogo";

const OFFICE_AREAS = ["OVERVIEW", "KYC", "CATALOG", "FINANCE", "TEAM", "MESSAGES", "NOTIFICATIONS"] as const;
const MESSAGE_SEEN_KEY = "zota_office_seen_messages_at";
const NOTIFICATION_SEEN_KEY = "zota_office_seen_notifications_at";

function formatIdentity(email?: string | null, phone?: string | null) {
  const seed = email?.split("@")[0] ?? phone ?? "Office User";
  return seed
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto inline-flex min-w-6 items-center justify-center rounded-full bg-slate-950 px-2 py-1 text-[11px] font-semibold leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function IconBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 py-1 text-[10px] font-semibold leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NavLink({ href, label, count = 0 }: { href: string; label: string; count?: number }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link className={`bm-nav-link ${active ? "is-active" : ""}`} href={href}>
      <span className="h-2 w-2 rounded-full bg-current/70" />
      {label}
      <CountBadge count={count} />
    </Link>
  );
}

function EnvelopeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V10a6 6 0 1 0-12 0v4.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M10 17a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [hasSession] = useState(() => !!readSession());
  const [messageCount, setMessageCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const session = readSession();
  const pathname = usePathname();
  const identity = useMemo(
    () => formatIdentity(session?.user.email, session?.user.phone),
    [session?.user.email, session?.user.phone],
  );
  const allOfficeAreas = useMemo(() => [...OFFICE_AREAS], []);
  const officeTitle = session?.user.officeTitle ?? (session?.user.isSuperAdmin ? "Super Admin" : "Office operator");
  const assignedPermissions = session?.user.officePermissions ?? [];
  const officePermissions = session?.user.isSuperAdmin || assignedPermissions.length === 0
    ? allOfficeAreas
    : assignedPermissions;

  useEffect(() => {
    if (!session?.user?.id || session.user.role !== "ADMIN") return;
    void apiPost("/admin/users/me/activity", {
      route: pathname,
      action: "office_navigation",
      details: { pathname },
    });

    const interval = window.setInterval(() => {
      void apiPost("/admin/users/me/activity", {
        route: pathname,
        action: "office_heartbeat",
        details: { pathname },
      });
    }, 30000);

    return () => window.clearInterval(interval);
  }, [pathname, session?.user?.id, session?.user?.role]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname.startsWith("/messages")) {
      window.localStorage.setItem(MESSAGE_SEEN_KEY, new Date().toISOString());
      setMessageCount(0);
    }
    if (pathname.startsWith("/notifications")) {
      window.localStorage.setItem(NOTIFICATION_SEEN_KEY, new Date().toISOString());
      setNotificationCount(0);
    }
  }, [pathname]);

  useEffect(() => {
    if (!session?.user?.id || session.user.role !== "ADMIN") return;

    const seenMessagesAt = () => {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(MESSAGE_SEEN_KEY);
    };
    const seenNotificationsAt = () => {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(NOTIFICATION_SEEN_KEY);
    };

    const loadIndicators = async () => {
      if (canAccess("MESSAGES")) {
        const res = await apiGet<{ ok: boolean; conversations: Array<{ lastMessageAt: string }> }>("/admin/communications");
        if (res.ok && res.data) {
          const marker = seenMessagesAt();
          const unread = res.data.conversations.filter((item) => !marker || new Date(item.lastMessageAt).getTime() > new Date(marker).getTime()).length;
          setMessageCount(pathname.startsWith("/messages") ? 0 : unread);
        }
      }

      if (canAccess("NOTIFICATIONS")) {
        const res = await apiGet<{ ok: boolean; notifications: Array<{ createdAt: string }> }>("/admin/notifications");
        if (res.ok && res.data) {
          const marker = seenNotificationsAt();
          const unread = res.data.notifications.filter((item) => !marker || new Date(item.createdAt).getTime() > new Date(marker).getTime()).length;
          setNotificationCount(pathname.startsWith("/notifications") ? 0 : unread);
        }
      }
    };

    void loadIndicators();
    const interval = window.setInterval(() => {
      void loadIndicators();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [pathname, session?.user?.id, session?.user?.role]);

  function logout() {
    void apiPost("/admin/users/me/logout", { route: pathname }).finally(() => {
      clearSession();
      fetch("/api/session/logout", { method: "POST" }).finally(() => {
        window.location.href = "/login";
      });
    });
  }

  function canAccess(area: string) {
    return officePermissions.includes(area);
  }

  if (session?.user?.isDisabled) {
    clearSession();
    fetch("/api/session/logout", { method: "POST" }).finally(() => {
      window.location.href = "/login";
    });
    return null;
  }

  if (!hasSession) {
    return <main className="bm-page min-h-screen">{children}</main>;
  }

  const sectionTitle =
    pathname.startsWith("/kyc")
      ? "Verification Queue"
      : pathname.startsWith("/catalog")
        ? "Catalog Review"
      : pathname.startsWith("/finance")
        ? "Finance Desk"
        : pathname.startsWith("/team")
          ? "Office Users"
        : pathname.startsWith("/messages")
          ? "Communications"
          : pathname.startsWith("/notifications")
            ? "Notifications"
            : "Overview";

  return (
    <main className="bm-page bm-shell">
      <aside className="bm-sidebar">
        <div className="min-h-0">
          <ZotaLogo size={44} />
          <p className="mt-4 text-xl font-semibold tracking-[-0.04em] text-slate-950">Zota Office</p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Operations</p>
        </div>

        <div className="mt-8 flex flex-col gap-2">
          {canAccess("OVERVIEW") ? <NavLink href="/dashboard" label="Overview" /> : null}
          {canAccess("KYC") ? <NavLink href="/kyc" label="Verification Queue" /> : null}
          {canAccess("CATALOG") ? <NavLink href="/catalog" label="Catalog Review" /> : null}
          {canAccess("FINANCE") ? <NavLink href="/finance" label="Finance Desk" /> : null}
          {canAccess("TEAM") ? <NavLink href="/team" label="Office Users" /> : null}
          {canAccess("MESSAGES") ? <NavLink href="/messages" label="Communications" count={messageCount} /> : null}
          {canAccess("NOTIFICATIONS") ? <NavLink href="/notifications" label="Notifications" count={notificationCount} /> : null}
        </div>

        <div className="mt-auto rounded-[24px] border border-slate-200 bg-white/80 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Signed in</p>
          <p className="mt-2 text-base font-semibold text-slate-950">{identity}</p>
          <p className="mt-1 text-sm text-slate-500">{session?.user.email ?? session?.user.phone ?? "Office operator"}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{officeTitle}</p>
          <button className="mt-4 bm-btn w-full" onClick={logout}>Logout</button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="bm-mobile-topbar">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Zota Office</p>
            <p className="text-lg font-semibold tracking-[-0.03em] text-slate-950">{sectionTitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {canAccess("MESSAGES") ? <Link href="/messages" aria-label="Messages" className="bm-btn relative !px-3"><EnvelopeIcon /><IconBadge count={messageCount} /></Link> : null}
            {canAccess("NOTIFICATIONS") ? <Link href="/notifications" aria-label="Notifications" className="bm-btn relative !px-3"><BellIcon /><IconBadge count={notificationCount} /></Link> : null}
          </div>
        </header>

        <div className="bm-main">
          <div className="mb-5 hidden items-center justify-between gap-4 lg:flex">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Zota Office</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{sectionTitle}</h2>
            </div>
            <div className="flex items-center gap-2">
              {canAccess("MESSAGES") ? <Link href="/messages" aria-label="Messages" className="bm-btn relative !px-3"><EnvelopeIcon /><IconBadge count={messageCount} /></Link> : null}
              {canAccess("NOTIFICATIONS") ? <Link href="/notifications" aria-label="Notifications" className="bm-btn relative !px-3"><BellIcon /><IconBadge count={notificationCount} /></Link> : null}
            </div>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
