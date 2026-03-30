"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { clearSession, readSession } from "@/lib/session";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link className={`bm-nav-link ${active ? "is-active" : ""}`} href={href}>
      {label}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [hasSession] = useState(() => !!readSession());

  return (
    <main className="bm-page bm-fade-in">
      <header className="bm-topbar">
        <div>
          <p className="bm-top-kicker">Beautiful Mind</p>
          <h1 className="bm-top-title">Admin</h1>
        </div>
        <nav className="bm-nav">
          <NavLink href="/" label="Landing" />
          <NavLink href="/login" label="Login" />
          <NavLink href="/dashboard" label="Dashboard" />
          <NavLink href="/kyc" label="KYC Queue" />
          <NavLink href="/finance" label="Finance" />
          {hasSession && (
            <button
              className="bm-btn"
              onClick={() => {
                clearSession();
                fetch("/api/session/logout", { method: "POST" }).finally(() => { window.location.href = "/login"; });
              }}
            >
              Logout
            </button>
          )}
        </nav>
      </header>
      <div className="bm-content">{children}</div>
    </main>
  );
}
