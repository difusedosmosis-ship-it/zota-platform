"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearSession, readSession } from "@/lib/session";
import { useMemo, useState } from "react";
import { ZotaLogo } from "@/components/ZotaLogo";

function MenuLink({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`bm-menu-link ${
        active
          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
          : "text-slate-700 border-black/10 hover:bg-slate-50"
      }`}
    >
      {label}
    </Link>
  );
}

function IconButton({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} aria-label={label} className="bm-icon-btn">
      {children}
    </Link>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V10a6 6 0 1 0-12 0v4.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M10 17a2 2 0 0 0 4 0" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 3v-3H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function FooterIcon({ name }: { name: "home" | "services" | "requests" | "wallet" | "account" }) {
  if (name === "home") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <path d="m3 11 9-7 9 7" />
        <path d="M5 10v9h14v-9" />
        <path d="M9 19v-5h6v5" />
      </svg>
    );
  }
  if (name === "services") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 7h16" />
        <path d="M4 12h10" />
        <path d="M4 17h16" />
        <circle cx="18" cy="12" r="2" />
      </svg>
    );
  }
  if (name === "requests") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M8 9h8M8 13h8M8 17h5" />
      </svg>
    );
  }
  if (name === "wallet") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <rect x="2.5" y="6" width="19" height="13" rx="2.5" />
        <path d="M2.5 9.5h19" />
        <circle cx="16.5" cy="13.5" r="1.4" />
      </svg>
    );
  }
  if (name === "account") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 19c1.8-3.2 4.2-4.8 7-4.8s5.2 1.6 7 4.8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

type FooterItem = {
  href: string;
  label: string;
  icon: "home" | "services" | "requests" | "wallet" | "account";
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const [hasSession] = useState(() => !!readSession());
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const footerItems = useMemo<FooterItem[]>(
    () => [
      { href: "/dashboard", label: "Home", icon: "home" },
      { href: "/services", label: "Services", icon: "services" },
      { href: "/requests", label: "Requests", icon: "requests" },
      { href: "/wallet", label: "Wallet", icon: "wallet" },
      { href: "/account", label: "Account", icon: "account" },
    ],
    [],
  );

  return (
    <div className="bm-safe-page min-h-screen w-full bg-[#f6f7f9] text-slate-900">
      <header
        className="fixed z-50 rounded-[24px] border border-black/10 bg-white/95 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur-xl"
        style={{
          top: "calc(var(--safe-top) + 14px)",
          left: "calc(var(--safe-left) + 8px)",
          right: "calc(var(--safe-right) + 8px)",
        }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <button aria-label="Open menu" className="bm-icon-btn" onClick={() => setMenuOpen(true)}>
              <span className="bm-hamburger" />
            </button>
            <div>
              <ZotaLogo size={36} compact showWordmark={false} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasSession && (
              <>
                <IconButton href="/messages" label="Inbox">
                  <MessageIcon />
                </IconButton>
                <IconButton href="/notifications" label="Notifications">
                  <BellIcon />
                </IconButton>
              </>
            )}
          </div>
        </div>
      </header>

      {menuOpen && (
        <>
          <button className="bm-overlay" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <aside className="bm-side-sheet">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Zota Business</p>
                <h3 className="text-lg font-semibold text-slate-900">Control Room</h3>
              </div>
              <button className="bm-icon-btn" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
                ✕
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <MenuLink href="/dashboard" label="Overview" onClick={() => setMenuOpen(false)} />
              <MenuLink href="/services" label="Services & Listings" onClick={() => setMenuOpen(false)} />
              <MenuLink href="/messages" label="Inbox & Calls" onClick={() => setMenuOpen(false)} />
              <MenuLink href="/wallet" label="Wallet" onClick={() => setMenuOpen(false)} />
              <MenuLink href="/notifications" label="Alerts" onClick={() => setMenuOpen(false)} />
              <MenuLink href="/account" label="Account" onClick={() => setMenuOpen(false)} />
            </div>

            {hasSession && (
              <button
                className="mt-5 rounded-xl border border-black/10 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  clearSession();
                  fetch("/api/session/logout", { method: "POST" }).finally(() => {
                    window.location.href = "/login";
                  });
                }}
              >
                Logout
              </button>
            )}
          </aside>
        </>
      )}

      <main
        className="bm-main-shell"
        style={{
          paddingTop: "calc(var(--safe-top) + 98px)",
          paddingBottom: "max(112px, calc(90px + var(--safe-bottom)))",
        }}
      >
        {children}
      </main>

      <footer className="bm-mobile-footer">
        {footerItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href} className={`bm-footer-item ${active ? "is-active" : ""}`}>
              <span className="bm-footer-icon"><FooterIcon name={item.icon} /></span>
              <span className="bm-footer-label">{item.label}</span>
            </Link>
          );
        })}
      </footer>
    </div>
  );
}
