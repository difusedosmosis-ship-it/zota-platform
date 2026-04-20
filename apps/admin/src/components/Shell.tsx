"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { clearSession, readSession } from "@/lib/session";
import { ZotaLogo } from "@/components/ZotaLogo";

function formatIdentity(email?: string | null, phone?: string | null) {
  const seed = email?.split("@")[0] ?? phone ?? "Office User";
  return seed
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link className={`bm-nav-link ${active ? "is-active" : ""}`} href={href}>
      <span className="h-2 w-2 rounded-full bg-current/70" />
      {label}
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
  const session = readSession();
  const pathname = usePathname();
  const identity = useMemo(
    () => formatIdentity(session?.user.email, session?.user.phone),
    [session?.user.email, session?.user.phone],
  );

  function logout() {
    clearSession();
    fetch("/api/session/logout", { method: "POST" }).finally(() => {
      window.location.href = "/login";
    });
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
        <div>
          <ZotaLogo size={44} />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Operations</p>
          <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-slate-950">Office Console</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Verification, finance, communications, and governance across Zota Consumer and Zota Business.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-2">
          <NavLink href="/dashboard" label="Overview" />
          <NavLink href="/kyc" label="Verification Queue" />
          <NavLink href="/catalog" label="Catalog Review" />
          <NavLink href="/finance" label="Finance Desk" />
          <NavLink href="/team" label="Office Users" />
          <NavLink href="/messages" label="Communications" />
          <NavLink href="/notifications" label="Notifications" />
        </div>

        <div className="mt-auto rounded-[24px] border border-slate-200 bg-white/80 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Signed in</p>
          <p className="mt-2 text-base font-semibold text-slate-950">{identity}</p>
          <p className="mt-1 text-sm text-slate-500">{session?.user.email ?? session?.user.phone ?? "Office operator"}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Office operator</p>
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
            <Link href="/messages" aria-label="Messages" className="bm-btn !px-3"><EnvelopeIcon /></Link>
            <Link href="/notifications" aria-label="Notifications" className="bm-btn !px-3"><BellIcon /></Link>
          </div>
        </header>

        <div className="bm-main">
          <div className="mb-5 hidden items-center justify-between gap-4 lg:flex">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Zota Office</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{sectionTitle}</h2>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/messages" aria-label="Messages" className="bm-btn !px-3"><EnvelopeIcon /></Link>
              <Link href="/notifications" aria-label="Notifications" className="bm-btn !px-3"><BellIcon /></Link>
            </div>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
