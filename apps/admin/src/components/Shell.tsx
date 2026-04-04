"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { clearSession, readSession } from "@/lib/session";
import { ZotaLogo } from "@/components/ZotaLogo";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
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
          <div style={{ marginBottom: 8 }}>
            <ZotaLogo size={36} />
          </div>
          <p className="bm-top-kicker">Zota Office</p>
          <h1 className="bm-top-title">Admin Control</h1>
        </div>
        <nav className="bm-nav">
          {hasSession ? (
            <>
              <NavLink href="/dashboard" label="Overview" />
              <NavLink href="/kyc" label="KYC" />
              <NavLink href="/finance" label="Finance" />
              <button
                className="bm-btn"
                onClick={() => {
                  clearSession();
                  fetch("/api/session/logout", { method: "POST" }).finally(() => {
                    window.location.href = "/login";
                  });
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <NavLink href="/login" label="Login" />
          )}
        </nav>
      </header>
      <div className="bm-content">{children}</div>
    </main>
  );
}
