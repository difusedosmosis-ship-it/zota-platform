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

export function AppShell({ children }: { children: React.ReactNode }) {
  const [hasSession] = useState(() => !!readSession());
  const session = readSession();
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

  return (
    <main className="bm-page bm-shell">
      <aside className="bm-sidebar">
        <div>
          <ZotaLogo size={44} />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Operations</p>
          <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-slate-950">Office Console</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Verification, finance, policy, and governance across Zota Consumer and Zota Business.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-2">
          <NavLink href="/dashboard" label="Overview" />
          <NavLink href="/kyc" label="Verification Queue" />
          <NavLink href="/finance" label="Finance" />
        </div>

        <div className="mt-auto rounded-[24px] border border-slate-200 bg-white/80 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Signed in</p>
          <p className="mt-2 text-base font-semibold text-slate-950">{identity}</p>
          <p className="mt-1 text-sm text-slate-500">{session?.user.email ?? session?.user.phone ?? "Admin"}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{session?.user.role}</p>
          <button className="mt-4 bm-btn w-full" onClick={logout}>Logout</button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="bm-mobile-topbar">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Zota Office</p>
            <p className="text-lg font-semibold tracking-[-0.03em] text-slate-950">{identity}</p>
          </div>
          <button className="bm-btn" onClick={logout}>Logout</button>
        </header>
        <div className="bm-main">{children}</div>
      </div>
    </main>
  );
}
